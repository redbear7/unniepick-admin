/**
 * GET /api/admin/users
 *
 * admin_get_user_phones() RPC로 auth.users 직접 조회 (전화번호 포함)
 * auth.admin.listUsers는 "Database error finding users" 버그로 우회
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

  // 1) auth.users 전화번호 조회 — RPC(SECURITY DEFINER) 사용
  //    auth.admin.listUsers는 "Database error finding users" 버그로 우회
  const authUsers: Record<string, { phone?: string; last_sign_in_at?: string }> = {};
  let phonesError: string | null = null;
  try {
    const { data, error } = await sb.rpc('admin_get_user_phones');
    if (error) {
      phonesError = error.message;
      console.error('[admin/users] admin_get_user_phones error:', error.message);
    } else {
      for (const u of (data ?? []) as Array<{
        id: string; phone: string | null; last_sign_in_at: string | null;
      }>) {
        authUsers[u.id] = {
          phone:           normalizePhone(u.phone),
          last_sign_in_at: u.last_sign_in_at ?? undefined,
        };
      }
      console.log('[admin/users] auth users 조회:', Object.keys(authUsers).length, '명');
    }
  } catch (e) {
    phonesError = String(e);
    console.error('[admin/users] admin_get_user_phones exception:', e);
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
    followSet:   [...followSet],
    couponCount,
    _phonesError: phonesError,
    _authUserCount: Object.keys(authUsers).length,
  });
}
