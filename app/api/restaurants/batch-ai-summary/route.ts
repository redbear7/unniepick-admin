/**
 * POST /api/restaurants/batch-ai-summary
 * body: { limit?: number, source?: 'naver' | 'kakao' | 'all' }
 *
 * ai_summary가 없는 업체부터 Gemini 요약 생성
 * - naver: 네이버 크롤링 업체만
 * - kakao: 카카오 수집 업체만
 * - all: 전체 (기본값)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    limit?: number;
    source?: 'naver' | 'kakao' | 'all';
  };
  const limit  = Math.min(50, body.limit ?? 10);
  const source = body.source ?? 'all';

  const sb = adminSb();

  let query = sb
    .from('restaurants')
    .select('naver_place_id, kakao_place_id, source')
    .is('ai_summary', null);

  if (source === 'naver') query = query.eq('source', 'naver').not('naver_place_id', 'is', null);
  if (source === 'kakao') query = query.eq('source', 'kakao').not('kakao_place_id', 'is', null);

  const { data: rows, error } = await query.limit(limit);

  if (error)       return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ ok: true, processed: 0, errors: 0, message: '처리할 업체 없음' });

  const base = new URL('/api/restaurants/ai-summary', req.url).toString();
  let processed = 0;
  let errors    = 0;

  for (const row of rows) {
    try {
      // naver_place_id 우선, 없으면 kakao_place_id
      const bodyPayload = row.naver_place_id
        ? { naver_place_id: row.naver_place_id }
        : { kakao_place_id: row.kakao_place_id };

      const res = await fetch(base, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(bodyPayload),
      });
      if (res.ok) processed++;
      else {
        const err = await res.json().catch(() => ({}));
        console.error('[batch-ai-summary] 오류:', err);
        errors++;
      }
    } catch (e) {
      console.error('[batch-ai-summary] fetch 오류:', e);
      errors++;
    }
    // Gemini 무료 티어 15 RPM 대응 (4.5초 간격)
    await new Promise(r => setTimeout(r, 4500));
  }

  return NextResponse.json({ ok: true, processed, errors });
}
