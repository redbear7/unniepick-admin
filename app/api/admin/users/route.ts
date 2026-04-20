/**
 * GET /api/admin/users
 *
 * service_role 키로 auth.admin.listUsers를 호출해 전화번호 포함
 * 추가 데이터: push_tokens, follows(GPS 여부), user_coupons(쿠폰 수)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** E.164 → 한국 로컬 번호 (예: +821012345678 → 01012345678) */
function normalizePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('82') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  return digits || undefined;
}

export async function GET() {
  const sb = adminClient();

  // 1) auth.admin.listUsers — 전화번호 포함 (최대 1000명)
  const authUsers: Record<string, { phone?: string; last_sign_in_at?: string }> = {};
  try {
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        authUsers[u.id] = {
          phone:           normalizePhone(u.phone),
          last_sign_in_at: u.last_sign_in_at || undefined,
        };
      }
      if (data.users.length < perPage) break;
      page++;
    }
  } catch (e) {
    console.error('[admin/users] listUsers error:', e);
  }

  // 2) push_tokens — 유저별 opt_in 여부
  const pushMap: Record<string, boolean> = {};
  try {
    const { data } = await sb
      .from('push_tokens')
      .select('user_id, opt_in')
      .eq('opt_in', true);
    for (const r of data ?? []) pushMap[r.user_id] = true;
  } catch { /* 테이블 없으면 무시 */ }

  // 3) follows — 팔로우한 유저 목록 (GPS 인증 여부 추론)
  const followSet = new Set<string>();
  try {
    const { data } = await sb
      .from('follows')
      .select('user_id');
    for (const r of data ?? []) followSet.add(r.user_id);
  } catch { /* 테이블 없으면 무시 */ }

  // 4) user_coupons — 유저별 보유 쿠폰 수
  const couponCount: Record<string, number> = {};
  try {
    const { data } = await sb
      .from('user_coupons')
      .select('user_id');
    for (const r of data ?? []) {
      couponCount[r.user_id] = (couponCount[r.user_id] ?? 0) + 1;
    }
  } catch { /* 테이블 없으면 무시 */ }

  return NextResponse.json({
    authUsers,
    pushMap,
    followSet: [...followSet],
    couponCount,
  });
}
