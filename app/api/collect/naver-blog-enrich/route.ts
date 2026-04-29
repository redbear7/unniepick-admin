/**
 * POST /api/collect/naver-blog-enrich
 * body: { keywords: string[], limit?: number }
 *
 * 네이버 블로그 검색 API로 업체별 리뷰 보강
 * - 3중 연관성 필터: 이름 매칭 + 지역 일치 + 음식 컨텍스트
 * - .env: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 * - SSE(text/event-stream)으로 진행 상황 실시간 전달
 */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface BlogReview {
  title:   string;
  snippet: string;
  date:    string;
  source:  'blog' | 'cafe';
  link:    string;
}

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .trim();
}

// ── 상호명 토큰 추출 ─────────────────────────────────────────────
function extractNameTokens(name: string): { full: string; brand: string; words: string[] } {
  const cleaned = name.trim();
  const parts   = cleaned.split(/\s+/);
  const branchSuffix = /^.{1,6}(점|지점|분점|본점|직영점|센터)$/;

  let brand = cleaned;
  if (parts.length >= 2 && branchSuffix.test(parts[parts.length - 1])) {
    brand = parts.slice(0, -1).join(' ');
  }

  const words = [...new Set([cleaned, brand, ...parts].filter(w => w.length >= 2))];
  return { full: cleaned, brand, words };
}

// ── 주소에서 지역 토큰 추출 ──────────────────────────────────────
function extractLocationTokens(address: string | null): string[] {
  if (!address) return ['창원'];
  const tokens: string[] = [];

  const cityMatch = address.match(/(창원|김해|마산|진해|고성|통영|거제|함안|밀양)/);
  if (cityMatch) tokens.push(cityMatch[1]);

  const districtMatches = address.match(/\S+[구군면]/g);
  if (districtMatches) tokens.push(...districtMatches);

  const dongMatches = address.match(/\S+동/g);
  if (dongMatches) tokens.push(...dongMatches.slice(0, 2));

  return tokens.length ? [...new Set(tokens)] : ['창원'];
}

// ── 음식 관련 컨텍스트 키워드 ────────────────────────────────────
const FOOD_KW = [
  '맛집', '맛있', '먹었', '먹고', '먹방', '식당', '음식', '메뉴', '주문', '요리',
  '점심', '저녁', '아침', '브런치', '디저트', '카페', '커피', '빵', '케이크', '술',
  '맥주', '소주', '막걸리', '치킨', '피자', '라면', '국밥', '냉면', '갈비', '삼겹',
  '오마카세', '버거', '초밥', '파스타', '쌀국수', '곱창', '족발', '보쌈', '분식',
  '방문', '후기', '리뷰', '추천', '가격', '포장', '배달', '웨이팅', '영업시간',
  '주차', '테이블', '인테리어', '분위기',
];

// ── 비식품 블랙리스트 (식당에 무관한 명백한 카테고리) ─────────────
const OFFTRACK_KW = [
  '목걸이', '귀걸이', '반지', '팔찌', '쥬얼리', '주얼리', '보석', '다이아',
  '시계', '가방', '지갑', '구두', '신발', '의류', '옷', '패션', '화장품',
  '스킨케어', '향수', '네일', '속눈썹',
  '아파트', '청약', '분양', '부동산', '임대', '매매',
  '자동차', '차량', '보험', '대출', '주식', '코인', '비트코인',
  '학원', '과외', '성형', '병원', '치과', '한의원',
];

// ── 연관성 점수 계산 ─────────────────────────────────────────────
// 반환값 0 → 제외
//
// isBranch = 상호명에 지점 접미사가 있음 ("투다리 이미지점" 등)
//   → 브랜드명이 본문에만 등장하면 "지나가는 언급"으로 간주 → 제외
//   → 반드시 제목에 브랜드/전체명이 있거나, 전체명이 본문에 있어야 통과
// !isBranch = 단독 상호명 ("티파니", "점빵" 등)
//   → 본문 매칭도 허용하되 지역+음식 컨텍스트 필요
function relevanceScore(
  review: BlogReview,
  tokens: ReturnType<typeof extractNameTokens>,
  locationTokens: string[],
): number {
  const title    = review.title;
  const snippet  = review.snippet;
  const text     = `${title} ${snippet}`;
  const isBranch = tokens.full !== tokens.brand;

  // 1. 비식품 블랙리스트 감지 → 제목에 전체 상호명 없으면 즉시 제외
  if (OFFTRACK_KW.some(kw => text.includes(kw)) && !title.includes(tokens.full)) return 0;

  // 2. 이름 매칭 점수
  let score = 0;
  if      (title.includes(tokens.full))  score = 4; // 제목에 전체 상호명
  else if (title.includes(tokens.brand)) score = 3; // 제목에 브랜드명
  else if (text.includes(tokens.full))   score = 2; // 본문에 전체 상호명
  else if (!isBranch && text.includes(tokens.brand)) score = 1; // 단독 상호: 본문 브랜드 허용
  // isBranch인데 브랜드가 본문에만 → score=0 (지나가는 언급)

  // 단어 분리 부분 매칭 (제목 한정)
  if (score === 0) {
    const matched = tokens.words.filter(w => w.length >= 2 && title.includes(w)).length;
    if (matched >= Math.ceil(tokens.words.length * 0.6)) score = 1;
  }
  if (score === 0) return 0;

  // 3. 지역 & 음식 컨텍스트
  const hasLocation = locationTokens.some(loc => text.includes(loc));
  const hasFoodCtx  = FOOD_KW.some(kw => text.includes(kw));

  // score 1: 지역 AND 음식 모두 있어야 통과
  if (score === 1 && !(hasLocation && hasFoodCtx)) return 0;

  // score 2: 지역 OR 음식 하나는 있어야 통과
  if (score === 2 && !hasLocation && !hasFoodCtx) return 0;

  // isBranch score 2(전체명이 본문에): 지역 일치까지 요구
  if (isBranch && score === 2 && !hasLocation) return 0;

  // 지역 일치 보너스
  if (hasLocation) score += 1;

  return score;
}

async function naverSearch(
  query: string,
  display: number,
  clientId: string,
  clientSecret: string,
): Promise<BlogReview[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encoded}&display=${display}&sort=sim`;

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!res.ok) return [];
  const data = await res.json();

  return (data.items ?? []).map((item: Record<string, string>) => ({
    title:   stripHtml(item.title ?? ''),
    snippet: stripHtml(item.description ?? ''),
    date:    item.postdate ?? '',
    link:    item.link ?? '',
    source:  'blog' as const,
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    keywords?: string[];
    limit?: number;
  };

  const keywords: string[] = body.keywords ?? [];
  const limit = Math.min(body.limit ?? 30, 50);

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 필요' }),
      { status: 500 },
    );
  }

  const sb      = adminSb();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); }
        catch { closed = true; }
      };

      send({ type: 'start', keywords, limit });

      let totalProcessed = 0;
      let totalErrors    = 0;

      const { data: rows, error } = await sb
        .from('restaurants')
        .select('id, name, address')
        .or('blog_reviews.is.null,blog_reviews.eq.[]')
        .order('crawled_at', { ascending: false })
        .limit(limit);

      if (error) {
        send({ type: 'log', keyword: 'DB', line: `DB 오류: ${error.message}`, isErr: true });
        send({ type: 'done', processed: 0, errors: 1 });
        closed = true;
        try { controller.close(); } catch {}
        return;
      }

      const restaurants = rows ?? [];
      send({ type: 'keyword', keyword: keywords[0] ?? '', index: 0, total: 1 });
      send({ type: 'log', keyword: keywords[0] ?? '', line: `블로그 리뷰 없는 업체 ${restaurants.length}개 검색 시작` });

      for (let j = 0; j < restaurants.length; j++) {
        if (closed) break;
        const r = restaurants[j];
        send({ type: 'log', keyword: keywords[0] ?? '', line: `[${j + 1}/${restaurants.length}] ${r.name}` });

        try {
          const locationTokens = extractLocationTokens(r.address);
          const cityHint = locationTokens[0] ?? '창원';

          // 동 단위까지 힌트에 포함 (정확도 향상)
          const dongHint = locationTokens.find(t => t.endsWith('동') || t.endsWith('구'));
          const searchQuery = dongHint
            ? `${r.name} ${cityHint} ${dongHint}`
            : `${r.name} ${cityHint}`;

          const tokens = extractNameTokens(r.name);

          // 후보 20건 수집 → 3중 필터 후 상위 8건
          const candidates = await naverSearch(searchQuery, 20, clientId, clientSecret);

          const scored = candidates
            .map(rv => ({ rv, score: relevanceScore(rv, tokens, locationTokens) }))
            .filter(x => x.score > 0)
            .sort((a, b) =>
              b.score !== a.score
                ? b.score - a.score
                : (b.rv.date > a.rv.date ? 1 : b.rv.date < a.rv.date ? -1 : 0),
            );

          const combined: BlogReview[] = scored.slice(0, 8).map(x => x.rv);
          const skipped = candidates.length - scored.length;
          const note    = skipped > 0 ? ` (무관 ${skipped}건 제외)` : '';

          const { error: updateErr } = await sb
            .from('restaurants')
            .update({ blog_reviews: combined })
            .eq('id', r.id);

          if (updateErr) {
            send({ type: 'log', keyword: keywords[0] ?? '', line: `  저장 오류: ${updateErr.message}`, isErr: true });
            totalErrors++;
          } else {
            send({ type: 'log', keyword: keywords[0] ?? '', line: `  ✓ ${combined.length}건 저장${note} → AI 요약 생성 중...` });
            totalProcessed++;

            try {
              const aiRes = await fetch(
                new URL('/api/restaurants/ai-summary', req.url).toString(),
                {
                  method:  'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body:    JSON.stringify({ restaurant_id: r.id }),
                },
              );
              if (aiRes.ok) {
                const aiData = await aiRes.json();
                send({ type: 'log', keyword: keywords[0] ?? '', line: `  ✨ AI 요약: ${aiData.summary?.slice(0, 40) ?? '생성됨'}` });
              } else {
                const err = await aiRes.json().catch(() => ({}));
                send({ type: 'log', keyword: keywords[0] ?? '', line: `  ⚠ AI 요약 실패: ${err.error ?? aiRes.status}`, isErr: true });
              }
            } catch (aiErr) {
              send({ type: 'log', keyword: keywords[0] ?? '', line: `  ⚠ AI 요약 오류: ${(aiErr as Error).message}`, isErr: true });
            }
          }
        } catch (e) {
          send({ type: 'log', keyword: keywords[0] ?? '', line: `  오류: ${(e as Error).message}`, isErr: true });
          totalErrors++;
        }

        await new Promise(r => setTimeout(r, 500));
      }

      send({ type: 'keyword_done', keyword: keywords[0] ?? '', code: 0 });
      send({ type: 'done', processed: totalProcessed, errors: totalErrors });
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
