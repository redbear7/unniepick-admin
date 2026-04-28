/**
 * POST /api/restaurants/ai-summary
 * body: { naver_place_id?: string, kakao_place_id?: string }
 *
 * 업체 정보를 Gemini에 넣어 AI 요약 생성 후 DB 저장
 * - 네이버 크롤링 데이터(별점·리뷰·키워드)는 AI 입력에만 사용, 외부 노출 금지
 * - 영업시간 제외 (자주 변경됨)
 * - 카카오 수집 업체도 지원 (naver 매칭 데이터 병합)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

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

  // 네이버 리뷰 키워드 — AI 입력용, 결과물에 직접 노출 금지
  // 부정 키워드 필터링 후 긍정적인 것만 활용
  const NEGATIVE_WORDS = ['별로', '실망', '불친절', '느려', '비싸', '작아', '좁아', '시끄럽', '냄새', '불만', '최악', '그냥'];
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

  // 블로그 제목만 (내용 X) — 분위기 파악용
  const blogHints = toArr<{ title: string }>(r.blog_reviews)
    .slice(0, 3)
    .map(b => b.title)
    .join(' / ');

  const category = (r.unniepick_category || r.category || '') as string;

  return `다음 음식점 정보를 참고해서 방문객이 바로 이해할 수 있는 특징 요약을 만들어줘.

업체명: ${r.name}
카테고리: ${category}
주소: ${r.address ?? '창원시'}
메뉴: ${menus || '정보 없음'}
손님 반응 키워드: ${reviewKw || '정보 없음'}
인기 메뉴 언급: ${menuKw || '정보 없음'}
블로그 분위기: ${blogHints || '정보 없음'}

주의사항:
- 긍정적이고 매력적인 표현만 사용 (부정적 내용 절대 포함 금지)
- 별점·리뷰수·방문자수 등 수치는 절대 언급하지 마
- 영업시간 언급하지 마
- 외부 플랫폼(네이버, 카카오) 이름 언급하지 마
- 자연스러운 우리말로 작성
- 추측이나 과장 없이 주어진 정보만 활용
- 정보가 부족하면 카테고리와 위치 기반으로 간결하게 작성

다음 JSON 형식으로만 응답해. 설명 없이 JSON만:
{
  "한줄요약": "20자 이내 핵심 특징 한 문장",
  "분위기태그": ["태그1", "태그2", "태그3"],
  "추천메뉴": ["메뉴1", "메뉴2"],
  "방문팁": "25자 이내 실용적인 방문 팁",
  "특징키워드": ["키워드1", "키워드2", "키워드3"]
}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    naver_place_id?: string;
    kakao_place_id?: string;
  };

  const { naver_place_id, kakao_place_id } = body;
  if (!naver_place_id && !kakao_place_id) {
    return NextResponse.json({ error: 'naver_place_id 또는 kakao_place_id 필요' }, { status: 400 });
  }

  const sb = adminSb();

  // ── 업체 조회 ──────────────────────────────────────────────────
  let data: Record<string, unknown> | null = null;
  let matchKey: { field: string; value: string };

  if (naver_place_id) {
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
    data = row as Record<string, unknown>;
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
    data = row as Record<string, unknown>;
    matchKey = { field: 'kakao_place_id', value: kakao_place_id! };

    // 카카오 업체인 경우 — 전화번호로 네이버 매칭 데이터 병합
    if (!data.naver_place_id) {
      const { data: naverRow } = await sb
        .from('restaurants')
        .select('menu_items, review_keywords, menu_keywords, blog_reviews')
        .eq('source', 'naver')
        .eq('name', data.name as string)
        .maybeSingle();
      if (naverRow) {
        // 네이버 데이터로 빈 필드 보강 (AI 입력용)
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

  // ── Gemini 호출 ────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 없음' }, { status: 500 });

  const ai     = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(data);

  let summary  = '';
  let features: AiFeatures = { 분위기태그: [], 추천메뉴: [], 방문팁: '', 특징키워드: [] };

  // 429 재시도: 15s → 35s → 60s (무료 티어 15 RPM 대응)
  const RETRY_DELAYS = [15_000, 35_000, 60_000];
  let lastErr: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model:    'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const text      = result.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        summary  = parsed.한줄요약 ?? '';
        features = {
          분위기태그: parsed.분위기태그 ?? [],
          추천메뉴:   parsed.추천메뉴   ?? [],
          방문팁:     parsed.방문팁     ?? '',
          특징키워드: parsed.특징키워드 ?? [],
        };
      }
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      const is429 = String(e).includes('429') || String(e).includes('RESOURCE_EXHAUSTED');
      if (is429 && attempt < RETRY_DELAYS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      if (is429) {
        return NextResponse.json({ error: 'rate_limit', message: 'Gemini 요청 한도 초과 (잠시 후 다시 시도)' }, { status: 429 });
      }
      return NextResponse.json({ error: `AI 오류: ${e}` }, { status: 500 });
    }
  }
  if (lastErr) return NextResponse.json({ error: `AI 오류: ${lastErr}` }, { status: 500 });

  // ── DB 저장 ────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { error: updateErr } = await sb
    .from('restaurants')
    .update({ ai_summary: summary, ai_features: features, ai_summary_at: now })
    .eq(matchKey.field, matchKey.value);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // stores 동기화 (naver_place_id 있는 경우만)
  if (data.naver_place_id) {
    await sb
      .from('stores')
      .update({ ai_summary: summary, ai_features: features, ai_summary_at: now })
      .eq('naver_place_id', data.naver_place_id as string);
  }

  return NextResponse.json({ ok: true, summary, features });
}
