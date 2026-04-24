/**
 * POST /api/review-claims/submit
 *
 * 앱 사용자가 네이버 리뷰 스크린샷 제출 → 즉시 승인 + 쿠폰 바로 발급
 * Body: { user_id, store_id, coupon_id?, screenshot_url }
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

  if (!user_id)        return NextResponse.json({ error: 'user_id 필요' },        { status: 400 });
  if (!store_id)       return NextResponse.json({ error: 'store_id 필요' },        { status: 400 });
  if (!screenshot_url) return NextResponse.json({ error: 'screenshot_url 필요' }, { status: 400 });

  const sb = adminClient();

  // 중복 확인 (이미 승인된 리뷰 있으면 거절)
  const { data: existing } = await sb
    .from('review_claims')
    .select('id')
    .eq('user_id', user_id)
    .eq('store_id', store_id)
    .eq('status', 'approved')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: '이미 리뷰 인증이 완료되어 있어요' }, { status: 409 });
  }

  // 즉시 approved 상태로 삽입
  const { data: claim, error: insertErr } = await sb
    .from('review_claims')
    .insert({
      user_id,
      store_id,
      coupon_id:   coupon_id ?? null,
      screenshot_url,
      status:      'approved',
      reviewed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[review-claims/submit]', insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // 쿠폰 즉시 발급
  let couponIssued = false;
  if (coupon_id) {
    try {
      const { data: already } = await sb
        .from('coupon_issues')
        .select('id')
        .eq('coupon_id', coupon_id)
        .eq('user_id', user_id)
        .maybeSingle();

      if (!already) {
        const { data: coupon } = await sb
          .from('coupons')
          .select('issued_count')
          .eq('id', coupon_id)
          .single();

        if (coupon) {
          await sb
            .from('coupon_issues')
            .insert({ coupon_id, user_id, store_id });
          await sb
            .from('coupons')
            .update({ issued_count: (coupon.issued_count ?? 0) + 1 })
            .eq('id', coupon_id);
          couponIssued = true;
        }
      } else {
        couponIssued = true; // 이미 발급됨
      }
    } catch (e) {
      console.error('[review-claims/submit] coupon issue error:', e);
    }
  }

  return NextResponse.json({ ok: true, id: claim.id, coupon_issued: couponIssued });
}
