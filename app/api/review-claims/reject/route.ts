/**
 * POST /api/review-claims/reject
 *
 * 어드민이 리뷰 인증 반려
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

  const { data: claim } = await sb
    .from('review_claims')
    .select('status')
    .eq('id', id)
    .single();

  if (!claim) return NextResponse.json({ error: '신청 내역 없음' }, { status: 404 });
  if (claim.status !== 'pending') return NextResponse.json({ error: '이미 처리된 신청입니다' }, { status: 409 });

  const { error } = await sb
    .from('review_claims')
    .update({ status: 'rejected', admin_note: admin_note ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
