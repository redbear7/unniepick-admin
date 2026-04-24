/**
 * GET /api/admin/users
 *
 * admin_get_user_phones() RPC로 auth.users 직접 조회 (전화번호 포함)
 * auth.admin.listUsers는 "Database error finding users" 버그로 우회
 * 추가 데이터: push_tokens, follows(GPS 여부), user_coupons(쿠폰 수), 최근 접속지역
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

/**
 * 주소에서 지역명 추출
 * "창원 의창구 팔용동 차룡로48번길 49" → "의창구 팔용동"
 * "경남 창원시 성산구 상남동 ..." → "성산구 상남동"
 */
function extractArea(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.trim().split(/\s+/);
  // "경남 창원시 성산구 상남동 ..."  → parts[2] + parts[3]
  // "창원 의창구 팔용동 ..."         → parts[1] + parts[2]
  if (parts.length >= 4 && parts[1]?.endsWith('시')) {
    return `${parts[2]} ${parts[3]}`;
  }
  if (parts.length >= 3) {
    return `${parts[1]} ${parts[2]}`;
  }
  return parts.slice(0, 2).join(' ') || null;
}

export async function GET() {
  const sb = adminClient();

  // 1) auth.users 전화번호 조회 — RPC(SECURITY DEFINER) 사용
  const authUsers: Record<string, { phone?: string; last_sign_in_at?: string }> = {};
  const providerMap: Record<string, 'phone' | 'kakao'> = {};
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
        const normalizedPhone = normalizePhone(u.phone);
        authUsers[u.id] = {
          phone:           normalizedPhone,
          last_sign_in_at: u.last_sign_in_at ?? undefined,
        };
        // phone이 있으면 전화번호 가입, 없으면 소셜(카카오) 가입
        providerMap[u.id] = normalizedPhone ? 'phone' : 'kakao';
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

  // 5) 최근 접속지역 — 유저별 최신 follows → store의 district 또는 address
  const recentArea: Record<string, string> = {};
  try {
    // 유저별 가장 최근 팔로우 1건 + 가게 district/address 조인
    const { data: followRows } = await sb
      .from('follows')
      .select('user_id, created_at, stores(district_id, address, districts(name))')
      .order('created_at', { ascending: false });

    // 유저별 첫 번째(최신) 레코드만 처리
    const seen = new Set<string>();
    for (const row of (followRows ?? []) as unknown as Array<{
      user_id: string;
      created_at: string;
      stores: {
        district_id: string | null;
        address: string | null;
        districts: { name: string } | null;
      } | null;
    }>) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);

      const districtName = row.stores?.districts?.name;
      if (districtName) {
        recentArea[row.user_id] = districtName;
      } else {
        const area = extractArea(row.stores?.address);
        if (area) recentArea[row.user_id] = area;
      }
    }
  } catch (e) {
    console.error('[admin/users] recentArea error:', e);
  }

  // 6) users 테이블 — 역할/이름 (서비스롤로 RLS 우회)
  const usersRoleMap: Record<string, { name: string; role: string }> = {};
  try {
    const { data: usersRows } = await sb
      .from('users')
      .select('id, name, role');
    for (const u of usersRows ?? []) {
      usersRoleMap[u.id] = { name: u.name, role: u.role };
    }
  } catch { /* 테이블 없으면 무시 */ }

  // 7) profiles — 가입지역 + 마지막 사용지역 (부정 사용 방지용)
  const locationMap: Record<string, {
    signup_address:    string | null;
    last_used_address: string | null;
    last_used_at:      string | null;
  }> = {};
  try {
    const { data: profRows } = await sb
      .from('profiles')
      .select('id, signup_address, last_used_address, last_used_at');
    for (const p of profRows ?? []) {
      locationMap[p.id] = {
        signup_address:    p.signup_address    ?? null,
        last_used_address: p.last_used_address ?? null,
        last_used_at:      p.last_used_at      ?? null,
      };
    }
  } catch { /* 컬럼 없으면 무시 */ }

  return NextResponse.json({
    authUsers,
    providerMap,
    pushMap,
    followSet:   [...followSet],
    couponCount,
    recentArea,
    usersRoleMap,
    locationMap,
    _phonesError: phonesError,
    _authUserCount: Object.keys(authUsers).length,
  });
}

