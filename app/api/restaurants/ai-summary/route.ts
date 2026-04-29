/**
 * POST /api/restaurants/ai-summary
 * body: { naver_place_id?: string, kakao_place_id?: string }
 *
 * 업체 정보를 DeepSeek V3 (via OpenRouter)에 넣어 AI 요약 생성 후 DB 저장
 * - 네이버 크롤링 데이터(별점·리뷰·키워드)는 AI 입력에만 사용, 외부 노출 금지
 * - 영업시간 제외 (자주 변경됨)
 * - 카카오 수집 업체도 지원 (naver 매칭 데이터 병합)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface AiFeatures {
  분위기태그: string[];
  추천메뉴:   string[];
  방문팁:     string;
  특징키워드: string[];
}

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * AI가 반환한 텍스트에서 JSON을 안전하게 파싱.
 * DeepSeek 등 LLM이 한글 키를 무따옴표로 쓰거나 후행 쉼표를 남기는 경우 자동 수정.
 */
function safeParseJson(raw: string): Record<string, unknown> | null {
  // 1차: 그대로 파싱
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { /* continue */ }

  // 2차: 공통 오류 수정 후 재시도
  const fixed = raw
    .replace(/,\s*([}\]])/g, '$1')                                              // 후행 쉼표 제거
    .replace(/([{,]\s*)([가-힣a-zA-Z_$][가-힣a-zA-Z0-9_$]*)\s*:/g, '$1"$2":'); // 무따옴표 키
  try { return JSON.parse(fixed) as Record<string, unknown>; } catch { /* continue */ }

  // 3차: 줄바꿈·탭 정규화 후 재시도
  const normalized = fixed.replace(/[\r\n\t]/g, ' ').replace(/\s{2,}/g, ' ');
  try { return JSON.parse(normalized) as Record<string, unknown>; } catch { /* continue */ }

  return null;
}

function toArr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

function buildPrompt(r: Record<string, unknown>): string {
  const menus = toArr<{ name: string; price?: string }>(r.menu_items)
    .slice(0, 10)
    .map(m => m.price ? `${m.name}(${m.price})` : m.name)
    .join(', ');

  const NEGATIVE_WORDS = [
    '별로', '실망', '불친절', '느려', '느림', '비싸', '작아', '좁아', '시끄럽', '냄새',
    '불만', '최악', '그냥', '보통', '그저', '애매', '아쉽', '별점', '위생', '불결',
    '주차', '대기', '오래', '기다', '복잡', '혼잡', '불편', '손님', '직원',
  ];
  const reviewKw = toArr<{ keyword: string; count: number }>(r.review_keywords)
    .filter(k => !NEGATIVE_WORDS.some(neg => k.keyword.includes(neg)))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(k => k.keyword)
    .join(', ');

  const menuKw = toArr<{ menu: string; count: number }>(r.menu_keywords)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map(k => k.menu)
    .join(', ');

  const blogHints = toArr<{ title: string; snippet?: string }>(r.blog_reviews)
    .slice(0, 4)
    .map(b => {
      const snippet = b.snippet ? ` — ${b.snippet.slice(0, 60)}` : '';
      return `${b.title}${snippet}`;
    })
    .join(' / ');

  const category = (r.unniepick_category || r.category || '') as string;

  return `당신은 창원시의 열정적인 홍보대사이자 맛집·카페·핫플레이스 전문 큐레이터입니다.
창원의 숨은 매력을 발굴해 "이 가게, 꼭 가봐야 해!"라는 설렘을 전하는 것이 당신의 사명입니다.

【소개할 가게】
업체명: ${r.name}
카테고리: ${category}
위치: ${r.address ?? '창원시'}
메뉴: ${menus || ''}
손님들이 자주 언급한 키워드: ${reviewKw || ''}
인기 메뉴: ${menuKw || ''}
블로그·카페 리뷰: ${blogHints || ''}

【큐레이터 작성 원칙】
- 이 가게만의 시그니처 메뉴·대표 음식의 맛·식감·향·비주얼을 생생하게 표현
- 공간 분위기·인테리어·특색 있는 강점을 부각
- 창원 시민과 방문객 모두가 "바로 가고 싶다"는 기대감이 생기도록 작성
- 따뜻하고 친근한 우리말로, 과장 없이 매력을 극대화

【절대 금지】
- 부정적 표현·단점·아쉬운 점 (단 한 글자도 금지)
- 가격·대기·주차·위생 관련 언급
- 별점·리뷰수 등 수치 언급
- 영업시간 언급
- 네이버·카카오 플랫폼명 언급
- "정보 없음" 표현을 결과에 포함하는 것

반드시 아래 JSON 형식만 출력. 마크다운·설명·코드블록 없이 JSON 객체만. 모든 키는 반드시 큰따옴표("") 사용:
{
  "한줄요약": "40자 이내 — 시그니처 메뉴·맛·분위기가 생생하게 느껴지는 한 문장",
  "분위기태그": ["태그1", "태그2", "태그3"],
  "추천메뉴": ["대표메뉴1", "대표메뉴2"],
  "방문팁": "40자 이내 — 이 가게를 더 특별하게 즐기는 팁",
  "특징키워드": ["이 가게만의 키워드1", "키워드2", "키워드3"]
}`;
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const RETRY_DELAYS = [5_000, 15_000, 30_000];

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://admin.unniepick.com',
        'X-Title': 'Unniepick Admin',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }

    if (res.status === 429 && attempt < RETRY_DELAYS.length) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    const errText = await res.text().catch(() => res.statusText);
    if (res.status === 429) throw new Error(`rate_limit: ${errText}`);
    throw new Error(`OpenRouter ${res.status}: ${errText}`);
  }

  throw new Error('최대 재시도 횟수 초과');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    naver_place_id?: string;
    kakao_place_id?: string;
    restaurant_id?: string;
  };

  const { naver_place_id, kakao_place_id, restaurant_id } = body;
  if (!naver_place_id && !kakao_place_id && !restaurant_id) {
    return NextResponse.json({ error: 'naver_place_id, kakao_place_id, 또는 restaurant_id 필요' }, { status: 400 });
  }

  const sb = adminSb();

  // ── 업체 조회 ──────────────────────────────────────────────────
  let data: Record<string, unknown> | null = null;
  let matchKey: { field: string; value: string };

  if (restaurant_id) {
    const { data: row, error } = await sb
      .from('restaurants')
      .select(
        'id, name, category, unniepick_category, kakao_category, address, ' +
        'menu_items, review_keywords, menu_keywords, blog_reviews, tags_v2, ' +
        'naver_place_id, kakao_place_id',
      )
      .eq('id', restaurant_id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row)  return NextResponse.json({ error: '업체 없음' }, { status: 404 });
    data = row as unknown as Record<string, unknown>;
    matchKey = { field: 'id', value: restaurant_id };
  } else if (naver_place_id) {
    const { data: row, error } = await sb
      .from('restaurants')
      .select(
        'id, name, category, unniepick_category, kakao_category, address, ' +
        'menu_items, review_keywords, menu_keywords, blog_reviews, tags_v2, ' +
        'naver_place_id, kakao_place_id',
      )
      .eq('naver_place_id', naver_place_id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row)  return NextResponse.json({ error: '업체 없음' }, { status: 404 });
    data = row as unknown as Record<string, unknown>;
    matchKey = { field: 'naver_place_id', value: naver_place_id };
  } else {
    const { data: row, error } = await sb
      .from('restaurants')
      .select(
        'id, name, category, unniepick_category, kakao_category, address, ' +
        'menu_items, review_keywords, menu_keywords, blog_reviews, tags_v2, ' +
        'naver_place_id, kakao_place_id',
      )
      .eq('kakao_place_id', kakao_place_id!)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row)  return NextResponse.json({ error: '업체 없음' }, { status: 404 });
    data = row as unknown as Record<string, unknown>;
    matchKey = { field: 'kakao_place_id', value: kakao_place_id! };

    // 카카오 업체 — 이름으로 네이버 데이터 병합
    if (!data.naver_place_id) {
      const { data: naverRow } = await sb
        .from('restaurants')
        .select('menu_items, review_keywords, menu_keywords, blog_reviews')
        .eq('source', 'naver')
        .eq('name', data.name as string)
        .maybeSingle();
      if (naverRow) {
        data = {
          ...data,
          menu_items:      data.menu_items      || naverRow.menu_items,
          review_keywords: data.review_keywords || naverRow.review_keywords,
          menu_keywords:   data.menu_keywords   || naverRow.menu_keywords,
          blog_reviews:    data.blog_reviews    || naverRow.blog_reviews,
        };
      }
    }
  }

  // ── OpenRouter 호출 ────────────────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY 없음' }, { status: 500 });

  const prompt = buildPrompt(data);
  let summary  = '';
  let features: AiFeatures = { 분위기태그: [], 추천메뉴: [], 방문팁: '', 특징키워드: [] };

  try {
    const text      = await callOpenRouter(prompt, apiKey);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = safeParseJson(jsonMatch[0]);
      if (parsed) {
        summary  = String(parsed.한줄요약 ?? '');
        features = {
          분위기태그: Array.isArray(parsed.분위기태그) ? parsed.분위기태그 as string[] : [],
          추천메뉴:   Array.isArray(parsed.추천메뉴)   ? parsed.추천메뉴   as string[] : [],
          방문팁:     String(parsed.방문팁 ?? ''),
          특징키워드: Array.isArray(parsed.특징키워드) ? parsed.특징키워드 as string[] : [],
        };
      } else {
        // JSON 파싱 완전 실패 → 정규식으로 한줄요약만 구조
        const m = text.match(/["']?한줄요약["']?\s*:\s*["']([^"'\n]{4,60})["']/);
        if (m) summary = m[1];
        console.warn('[ai-summary] JSON 파싱 실패, 한줄요약만 추출:', summary || '없음');
      }
    }
  } catch (e) {
    const msg = String(e);
    if (msg.startsWith('rate_limit')) {
      return NextResponse.json({ error: 'rate_limit', message: '요청 한도 초과 (잠시 후 다시 시도)' }, { status: 429 });
    }
    return NextResponse.json({ error: `AI 오류: ${msg}` }, { status: 500 });
  }

  // ── DB 저장 ────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { error: updateErr } = await sb
    .from('restaurants')
    .update({ ai_summary: summary, ai_features: features, ai_summary_at: now })
    .eq(matchKey.field, matchKey.value);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // stores 동기화
  if (data.naver_place_id) {
    await sb
      .from('stores')
      .update({ ai_summary: summary, ai_features: features, ai_summary_at: now })
      .eq('naver_place_id', data.naver_place_id as string);
  }

  return NextResponse.json({ ok: true, summary, features });
}
