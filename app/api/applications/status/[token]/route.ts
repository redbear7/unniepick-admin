/**
 * GET /api/applications/status/[token]
 *
 * review_token(UUID)으로 신청 내역 공개 조회
 * 민감 정보(owner_phone 일부 마스킹) 포함해서 반환
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// 전화번호 일부 마스킹: 01012345678 → 010-****-5678
function maskPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0,3)}-****-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0,3)}-***-${d.slice(6)}`;
  return p.slice(0, 3) + '****';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 400 });
  }

  const sb = adminClient();

  const { data, error } = await sb
    .from('store_applications')
    .select(
      'id, review_token, status, admin_note, created_at, reviewed_at, ' +
      'store_name, category, address, address_detail, phone, ' +
      'owner_name, owner_phone, has_agency, agency_name, verification_status, coupon_draft',
    )
    .eq('review_token', token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '신청 내역을 찾을 수 없습니다' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as Record<string, any>;

  return NextResponse.json({
    application: {
      ...row,
      owner_phone: maskPhone(String(row.owner_phone ?? '')),
    },
  });
}
