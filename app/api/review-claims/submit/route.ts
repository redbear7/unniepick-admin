/**
 * POST /api/review-claims/submit
 *
 * 앱 사용자가 네이버 리뷰 스크린샷을 업로드해 인증 신청
 * Body: { user_id, store_id, coupon_id, screenshot_url }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { user_id, store_id, coupon_id, screenshot_url } = await req.json();

  if (!user_id)        return NextResponse.json({ error: 'user_id 필요' }, { status: 400 });
  if (!store_id)       return NextResponse.json({ error: 'store_id 필요' }, { status: 400 });
  if (!screenshot_url) return NextResponse.json({ error: 'screenshot_url 필요' }, { status: 400 });

  const sb = adminClient();

  // 중복 신청 확인 (pending/approved)
  const { data: existing } = await sb
    .from('review_claims')
    .select('id, status')
    .eq('user_id', user_id)
    .eq('store_id', store_id)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existing) {
    const msg = existing.status === 'approved'
      ? '이미 승인된 리뷰 인증이 있어요'
      : '이미 심사 중인 인증 신청이 있어요';
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const { data, error } = await sb
    .from('review_claims')
    .insert({ user_id, store_id, coupon_id: coupon_id ?? null, screenshot_url, status: 'pending' })
    .select('id')
    .single();

  if (error) {
    console.error('[review-claims/submit]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
