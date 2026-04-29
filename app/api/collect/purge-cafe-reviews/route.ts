/**
 * POST /api/collect/purge-cafe-reviews
 * blog_reviews JSONB에서 source='cafe' 항목을 일괄 제거
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(_req: NextRequest) {
  const sb = adminSb();

  // blog_reviews가 있는 레스토랑 전체 조회
  const { data: rows, error } = await sb
    .from('restaurants')
    .select('id, blog_reviews')
    .not('blog_reviews', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = (rows ?? []).filter(r => {
    const arr = Array.isArray(r.blog_reviews) ? r.blog_reviews : [];
    return arr.some((rv: { source?: string }) => rv.source === 'cafe');
  });

  let updated = 0;
  for (const row of targets) {
    const filtered = (row.blog_reviews as Array<{ source?: string }>)
      .filter(rv => rv.source !== 'cafe');

    const { error: upErr } = await sb
      .from('restaurants')
      .update({ blog_reviews: filtered })
      .eq('id', row.id);

    if (!upErr) updated++;
  }

  return NextResponse.json({
    total: rows?.length ?? 0,
    targets: targets.length,
    updated,
  });
}
