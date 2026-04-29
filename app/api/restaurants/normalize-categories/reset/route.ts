/**
 * POST /api/restaurants/normalize-categories/reset
 * 전체 restaurants 의 unniepick_category 를 NULL 로 초기화 (롤백)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST() {
  const sb = adminSb();

  const { error, count } = await sb
    .from('restaurants')
    .update({ unniepick_category: null })
    .not('id', 'is', null)
    .select('id', { count: 'exact', head: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reset: count ?? '?' });
}
