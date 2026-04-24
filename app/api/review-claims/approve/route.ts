/**
 * POST /api/review-claims/approve
 *
 * 어드민이 리뷰 인증 승인 → coupon_issues에 발급 기록 추가
 * Body: { id, admin_note? }
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
  const { id, admin_note } = await req.json();
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const sb = adminClient();

  // 클레임 조회
  const { data: claim, error: fetchErr } = await sb
    .from('review_claims')
    .select('id, user_id, store_id, coupon_id, status')
    .eq('id', id)
    .single();

  if (fetchErr || !claim) return NextResponse.json({ error: '신청 내역 없음' }, { status: 404 });
  if (claim.status !== 'pending') return NextResponse.json({ error: '이미 처리된 신청입니다' }, { status: 409 });

  // 쿠폰이 지정된 경우 coupon_issues 발급
  let couponIssueId: string | null = null;
  if (claim.coupon_id) {
    // 이미 발급됐는지 확인
    const { data: already } = await sb
      .from('coupon_issues')
      .select('id')
      .eq('coupon_id', claim.coupon_id)
      .eq('user_id', claim.user_id)
      .maybeSingle();

    if (!already) {
      // 쿠폰 issued_count 증가 + coupon_issues 삽입
      const { data: coupon } = await sb
        .from('coupons')
        .select('issued_count, total_quantity, expires_at')
        .eq('id', claim.coupon_id)
        .single();

      if (coupon) {
        const { data: issue } = await sb
          .from('coupon_issues')
          .insert({ coupon_id: claim.coupon_id, user_id: claim.user_id, store_id: claim.store_id })
          .select('id')
          .single();

        couponIssueId = issue?.id ?? null;

        await sb
          .from('coupons')
          .update({ issued_count: (coupon.issued_count ?? 0) + 1 })
          .eq('id', claim.coupon_id);
      }
    }
  }

  // 클레임 상태 업데이트
  const { error: updateErr } = await sb
    .from('review_claims')
    .update({ status: 'approved', admin_note: admin_note ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) {
    console.error('[review-claims/approve]', updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, coupon_issue_id: couponIssueId });
}
