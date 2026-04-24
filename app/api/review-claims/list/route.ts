/**
 * GET /api/review-claims/list?status=pending&store_id=xxx
 *
 * 어드민용 리뷰 인증 신청 목록 조회
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status');   // pending | approved | rejected | (없으면 전체)
  const store_id = searchParams.get('store_id');

  const sb = adminClient();

  let query = sb
    .from('review_claims')
    .select(`
      id, status, screenshot_url, admin_note, created_at, reviewed_at,
      user_id,
      store_id,
      coupon_id,
      stores ( name, category ),
      profiles:user_id ( nickname, phone ),
      coupons:coupon_id ( title, discount_type, discount_value )
    `)
    .order('created_at', { ascending: false });

  if (status)   query = query.eq('status', status);
  if (store_id) query = query.eq('store_id', store_id);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ claims: data ?? [] });
}
