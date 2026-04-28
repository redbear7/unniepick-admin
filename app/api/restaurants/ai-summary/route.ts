/**
 * POST /api/restaurants/ai-summary
 * body: { naver_place_id: string }
 *
 * 업체 정보(메뉴·리뷰·태그)를 Gemini에 넣어 AI 특징 요약 생성 후 DB 저장
 * returns: { ok: true, summary: string, features: AiFeatures }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

interface AiFeatures {
  분위기태그: string[];
  추천메뉴: string[];
  방문팁: string;
  특징키워드: string[];
}

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function buildPrompt(r: Record<string, unknown>): string {
  const menus = (r.menu_items as Array<{ name: string; price?: string }> ?? [])
    .slice(0, 10)
    .map(m => m.price ? `${m.name}(${m.price})` : m.name)
    .join(', ');

  const reviewKw = (r.review_keywords as Array<{ keyword: string; count: number }> ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(k => k.keyword)
    .join(', ');

  const blogTitles = (r.blog_reviews as Array<{ title: string }> ?? [])
    .slice(0, 3)
    .map(b => b.title)
    .join(' / ');

  const tagsV2 = r.tags_v2 as Record<string, unknown> | null;
  const tagStr = tagsV2
    ? Object.entries(tagsV2)
        .filter(([k]) => !['신뢰도', 'summary'].includes(k))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`)
        .join(' | ')
    : '';

  return `다음 음식점 정보를 바탕으로 손님이 바로 이해할 수 있는 특징 요약을 만들어줘.

업체명: ${r.name}
카테고리: ${r.category ?? ''}
주소: ${r.address ?? ''}
영업시간: ${r.business_hours ?? '정보 없음'}
메뉴: ${menus || '정보 없음'}
방문자 리뷰 키워드: ${reviewKw || '정보 없음'}
블로그 리뷰 제목: ${blogTitles || '정보 없음'}
태그 분석: ${tagStr || '정보 없음'}
평점: ${r.rating ?? '?'} (리뷰 ${r.visitor_review_count ?? 0}개)

다음 JSON 형식으로만 응답해. 설명 없이 JSON만:
{
  "한줄요약": "20자 이내의 핵심 특징 한 문장",
  "분위기태그": ["태그1", "태그2", "태그3"],
  "추천메뉴": ["메뉴1", "메뉴2"],
  "방문팁": "30자 이내 실용적인 방문 팁",
  "특징키워드": ["키워드1", "키워드2", "키워드3"]
}`;
}

export async function POST(req: NextRequest) {
  const { naver_place_id } = await req.json().catch(() => ({})) as { naver_place_id?: string };
  if (!naver_place_id) {
    return NextResponse.json({ error: 'naver_place_id 필요' }, { status: 400 });
  }

  const sb = adminSb();

  const { data, error: fetchErr } = await sb
    .from('restaurants')
    .select(
      'name, category, address, business_hours, rating, visitor_review_count, ' +
      'menu_items, review_keywords, review_summary, blog_reviews, tags_v2',
    )
    .eq('naver_place_id', naver_place_id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!data)    return NextResponse.json({ error: '업체 없음' }, { status: 404 });

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 없음' }, { status: 500 });

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(data as unknown as Record<string, unknown>);

  let summary = '';
  let features: AiFeatures = { 분위기태그: [], 추천메뉴: [], 방문팁: '', 특징키워드: [] };

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text = result.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      summary = parsed.한줄요약 ?? '';
      features = {
        분위기태그:   parsed.분위기태그   ?? [],
        추천메뉴:     parsed.추천메뉴     ?? [],
        방문팁:       parsed.방문팁       ?? '',
        특징키워드:   parsed.특징키워드   ?? [],
      };
    }
  } catch (e) {
    return NextResponse.json({ error: `AI 오류: ${e}` }, { status: 500 });
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await sb
    .from('restaurants')
    .update({ ai_summary: summary, ai_features: features, ai_summary_at: now })
    .eq('naver_place_id', naver_place_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // stores 동기화
  await sb
    .from('stores')
    .update({ ai_summary: summary, ai_features: features, ai_summary_at: now })
    .eq('naver_place_id', naver_place_id);

  return NextResponse.json({ ok: true, summary, features });
}
