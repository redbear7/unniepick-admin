/**
 * PATCH /api/restaurants/blog-reviews
 * body: { id?: string; naver_place_id?: string; blog_reviews: BlogReview[] }
 * Service role 키로 blog_reviews 컬럼 업데이트 (RLS 우회)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'body 필요' }, { status: 400 });

  const { id, naver_place_id, blog_reviews } = body as {
    id?: string;
    naver_place_id?: string;
    blog_reviews: unknown[];
  };

  if (!Array.isArray(blog_reviews)) {
    return NextResponse.json({ error: 'blog_reviews 배열 필요' }, { status: 400 });
  }
  if (!id && !naver_place_id) {
    return NextResponse.json({ error: 'id 또는 naver_place_id 필요' }, { status: 400 });
  }

  const sb = adminSb();

  let query = sb.from('restaurants').update({ blog_reviews });
  if (id) {
    query = query.eq('id', id);
  } else {
    query = query.eq('naver_place_id', naver_place_id!);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
