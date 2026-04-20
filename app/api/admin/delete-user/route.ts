/**
 * DELETE /api/admin/delete-user
 * body: { userId: string }
 *
 * 1. auth.admin.deleteUser  → Supabase Auth 계정 삭제 (CASCADE 포함)
 * 2. public.users           → 직접 삭제
 * 3. public.profiles        → 직접 삭제
 * 4. public.follows         → 직접 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function DELETE(req: NextRequest) {
  const { userId } = await req.json().catch(() => ({}));
  if (!userId) {
    return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
  }

  const sb = adminClient();

  // 1) auth.users 삭제 (service role 필요)
  const { error: authErr } = await sb.auth.admin.deleteUser(userId);
  if (authErr) {
    // 이미 없는 경우 무시
    if (!authErr.message?.includes('not found') && !authErr.message?.includes('User not found')) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }
  }

  // 2) public 테이블들 — 에러 무시 (FK CASCADE 로 이미 삭제됐을 수 있음)
  await Promise.allSettled([
    sb.from('follows').delete().eq('user_id', userId),
    sb.from('profiles').delete().eq('id', userId),
    sb.from('users').delete().eq('id', userId),
  ]);

  return NextResponse.json({ ok: true });
}
