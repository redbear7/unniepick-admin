/**
 * POST /api/restaurants/search
 * body: { query: string }
 *
 * 창원 맛집 AI 검색 (실서비스용 공개 엔드포인트)
 * SSE stream:
 *   { type:'filter',   gu, dong, category, style, rewritten_intent, chips }
 *   { type:'candidates', count }
 *   { type:'recommendation', rank, restaurant_id, name, category, unniepick_style,
 *                            rating, review_count, blog_count, address, image_url,
 *                            phone, naver_place_url, kakao_place_url,
 *                            why, matched_signals, coupon? }
 *   { type:'done' }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openrouterChat } from '@/lib/openrouter';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const CATEGORIES = [
  '카페·디저트', '베이커리·빵집', '고기·구이', '해산물·회',
  '국밥·탕·찌개', '면류·냉면', '일식·초밥', '중식',
  '양식·파스타', '치킨·버거', '분식·떡볶이', '술집·이자카야',
  '브런치·샐러드', '한식',
] as const;

const STYLES = ['술자리', '회식·단체', '혼밥·간편식', '데이트·모임', '카페·여가', '일반식사'] as const;
const GU_LIST = ['성산구', '의창구', '마산합포구', '마산회원구', '진해구'] as const;

interface ParsedFilter {
  gu: string | null;
  dong: string | null;
  category: string | null;
  style: string | null;
  keywords: string[];
  rewritten_intent: string;
}

interface CandidateRow {
  id: string;
  name: string;
  unniepick_category: string | null;
  unniepick_style: string | null;
  address: string | null;
  road_address: string | null;
  rating: number | null;
  visitor_review_count: number | null;
  blog_reviews: unknown[] | null;
  ai_summary: string | null;
  image_url: string | null;
  phone: string | null;
  naver_place_url: string | null;
  kakao_place_url: string | null;
  naver_place_id: string | null;
  discovery_score: number | null;
  tags: string[] | null;
}

interface RankedItem {
  rank: number;
  restaurant_id: string;
  why: string;
  matched_signals: string[];
}

async function parseQuery(query: string): Promise<ParsedFilter> {
  const prompt = `창원 맛집 검색 쿼리를 JSON으로 파싱해줘. 값이 없으면 null.

쿼리: "${query}"

JSON 형식 (이 형식 그대로, 다른 텍스트 없이):
{
  "gu": "${GU_LIST.join('" | "')}" | null,
  "dong": "동 이름" | null,
  "category": "${CATEGORIES.join('" | "')}" | null,
  "style": "${STYLES.join('" | "')}" | null,
  "keywords": ["기타 키워드 배열 (룸, 뷰맛집, 파킹, 1인석 등)"],
  "rewritten_intent": "사용자 의도를 한 문장으로 요약"
}`;

  try {
    const text = await openrouterChat(prompt, { temperature: 0.2, maxTokens: 256 });
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    const parsed = JSON.parse(jsonStr);
    return {
      gu: parsed.gu ?? null,
      dong: parsed.dong ?? null,
      category: parsed.category ?? null,
      style: parsed.style ?? null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      rewritten_intent: parsed.rewritten_intent ?? query,
    };
  } catch {
    return { gu: null, dong: null, category: null, style: null, keywords: [], rewritten_intent: query };
  }
}

async function rankCandidates(
  filter: ParsedFilter,
  candidates: CandidateRow[],
): Promise<RankedItem[]> {
  if (!candidates.length) return [];

  const list = candidates.slice(0, 15).map((r, i) => {
    const blogCount = Array.isArray(r.blog_reviews) ? r.blog_reviews.length : 0;
    const hasCoupon = (r.discovery_score ?? 0) >= 1000;
    return `[${i + 1}] id:${r.id} | ${r.name} | ${r.unniepick_category ?? '기타'}${r.unniepick_style ? ' / ' + r.unniepick_style : ''} | ★${r.rating ?? '?'} 리뷰${r.visitor_review_count ?? 0}건 블로그${blogCount}건${hasCoupon ? ' 🎫쿠폰있음' : ''} | ${r.address ?? '주소미상'}${r.ai_summary ? ' | AI: ' + r.ai_summary.slice(0, 60) : ''}`;
  }).join('\n');

  const prompt = `사용자 요청: "${filter.rewritten_intent}"

아래 맛집 중 가장 잘 맞는 3~5개를 골라 추천해줘.
쿠폰이 있는 업체(🎫)와 블로그 리뷰가 많은 업체를 우선 고려해줘.

${list}

JSON 배열로만 응답 (다른 텍스트 없이):
[
  {
    "rank": 1,
    "restaurant_id": "id값 그대로",
    "why": "왜 이 곳이 잘 맞는지 2~3문장 (구체적으로, 쿠폰/블로그/AI요약 언급 가능)",
    "matched_signals": ["매칭 근거 2~4개 배열, 예: '블로그 리뷰 8건', '쿠폰 보유', '상남동 위치']"
  }
]`;

  try {
    const text = await openrouterChat(prompt, { temperature: 0.5, maxTokens: 1024 });
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] ?? '[]';
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { query } = await req.json().catch(() => ({})) as { query?: string };
  if (!query?.trim()) {
    return new Response('{"error":"query 필요"}', { status: 400 });
  }

  const sb  = adminSb();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)); }
        catch { closed = true; }
      };

      try {
        /* ── 1. 쿼리 파싱 ──────────────────────────────── */
        const filter = await parseQuery(query);

        const chips: { text: string; color: string }[] = [];
        if (filter.gu)       chips.push({ text: filter.gu,       color: '#3B82F6' });
        if (filter.dong)     chips.push({ text: filter.dong,     color: '#3B82F6' });
        if (filter.category) chips.push({ text: filter.category, color: '#FF6F0F' });
        if (filter.style)    chips.push({ text: filter.style,    color: '#8B5CF6' });
        filter.keywords.forEach(k => chips.push({ text: k, color: '#6B7280' }));

        send({ type: 'filter', ...filter, chips });

        /* ── 2. Supabase 쿼리 ──────────────────────────── */
        let q = sb
          .from('restaurants')
          .select('id, name, unniepick_category, unniepick_style, address, road_address, rating, visitor_review_count, blog_reviews, ai_summary, image_url, phone, naver_place_url, kakao_place_url, naver_place_id, discovery_score, tags')
          .neq('operating_status', 'inactive')
          .order('discovery_score', { ascending: false })
          .limit(30);

        if (filter.gu)       q = q.ilike('address', `%${filter.gu}%`);
        if (filter.dong)     q = q.ilike('address', `%${filter.dong}%`);
        if (filter.category) q = q.eq('unniepick_category', filter.category);
        if (filter.style)    q = q.eq('unniepick_style', filter.style);

        const { data: candidates } = await q;
        const rows = (candidates ?? []) as CandidateRow[];

        send({ type: 'candidates', count: rows.length });

        if (!rows.length) {
          send({ type: 'done' });
          controller.close();
          return;
        }

        /* ── 3. 파트너 쿠폰 조회 ───────────────────────── */
        const naverIds = rows.map(r => r.naver_place_id).filter(Boolean) as string[];
        const couponMap = new Map<string, { title: string; description: string; discount: string; valid_until: string; is_exclusive: boolean }>();

        if (naverIds.length) {
          const { data: storeRows } = await sb
            .from('stores')
            .select('id, naver_place_id')
            .in('naver_place_id', naverIds);

          const storeMap = new Map<string, string>(); // naver_place_id → store_id
          for (const s of storeRows ?? []) {
            if (s.naver_place_id) storeMap.set(s.naver_place_id, s.id);
          }

          const storeIds = [...storeMap.values()];
          if (storeIds.length) {
            const now = new Date().toISOString();
            const { data: couponRows } = await sb
              .from('coupons')
              .select('store_id, title, description, discount_value, discount_type, valid_until, is_exclusive')
              .in('store_id', storeIds)
              .eq('is_active', true)
              .or(`valid_until.is.null,valid_until.gte.${now}`)
              .order('created_at', { ascending: false });

            for (const c of couponRows ?? []) {
              // naver_place_id 역참조
              for (const [naverId, sId] of storeMap.entries()) {
                if (sId === c.store_id && !couponMap.has(naverId)) {
                  const disc = c.discount_type === 'percent'
                    ? `${c.discount_value}%`
                    : c.discount_type === 'amount'
                    ? `${Number(c.discount_value).toLocaleString()}원`
                    : (c.discount_value ?? '혜택');
                  couponMap.set(naverId, {
                    title:      c.title ?? '쿠폰',
                    description: c.description ?? '',
                    discount:   String(disc),
                    valid_until: c.valid_until ?? '',
                    is_exclusive: !!c.is_exclusive,
                  });
                }
              }
            }
          }
        }

        /* ── 4. Gemini 랭킹 ────────────────────────────── */
        const ranked = await rankCandidates(filter, rows);

        if (!ranked.length) {
          send({ type: 'done' });
          controller.close();
          return;
        }

        /* ── 5. 결과 스트리밍 ───────────────────────────── */
        const rowMap = new Map(rows.map(r => [r.id, r]));

        for (const item of ranked) {
          const row = rowMap.get(item.restaurant_id);
          if (!row) continue;

          const blogCount = Array.isArray(row.blog_reviews) ? row.blog_reviews.length : 0;
          const coupon    = row.naver_place_id ? couponMap.get(row.naver_place_id) ?? null : null;

          send({
            type:             'recommendation',
            rank:             item.rank,
            restaurant_id:    row.id,
            name:             row.name,
            category:         row.unniepick_category ?? '기타',
            unniepick_style:  row.unniepick_style,
            rating:           row.rating,
            review_count:     row.visitor_review_count,
            blog_count:       blogCount,
            address:          row.road_address ?? row.address,
            image_url:        row.image_url,
            phone:            row.phone,
            naver_place_url:  row.naver_place_url,
            kakao_place_url:  row.kakao_place_url,
            why:              item.why,
            matched_signals:  item.matched_signals,
            coupon,
          });

          // 카드 간 자연스러운 스트리밍 딜레이
          await new Promise(r => setTimeout(r, 300));
        }

        send({ type: 'done' });
      } catch (e) {
        send({ type: 'error', message: (e as Error).message });
      }

      closed = true;
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
