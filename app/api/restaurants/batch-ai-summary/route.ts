/**
 * POST /api/restaurants/batch-ai-summary
 * body: { limit?: number }   (default 20, max 50)
 *
 * ai_summary가 없는 업체부터 순서대로 Gemini 특징 요약 생성
 * returns: { ok: true, processed: number, errors: number }
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
  const body = await req.json().catch(() => ({})) as { limit?: number };
  const limit = Math.min(10, body.limit ?? 5);

  const sb = adminSb();
  const { data: rows, error } = await sb
    .from('restaurants')
    .select('naver_place_id')
    .is('ai_summary', null)
    .not('naver_place_id', 'is', null)
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ ok: true, processed: 0, errors: 0, message: '처리할 업체 없음' });

  const base = new URL('/api/restaurants/ai-summary', req.url).toString();
  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naver_place_id: row.naver_place_id }),
      });
      if (res.ok) processed++;
      else errors++;
    } catch {
      errors++;
    }
    // Gemini 무료 티어 15 RPM 대응 (4.5초 간격)
    await new Promise(r => setTimeout(r, 4500));
  }

  return NextResponse.json({ ok: true, processed, errors });
}
