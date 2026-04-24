/**
 * PATCH /api/admin/update-user
 * body: { userId: string, name?: string, role?: string }
 *
 * users 테이블 name / role 수정
 * profiles 테이블 nickname 도 함께 동기화
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const VALID_ROLES = ['customer', 'owner', 'admin', 'superadmin', 'developer'];

export async function PATCH(req: NextRequest) {
  const { userId, name, role } = await req.json().catch(() => ({})) as {
    userId?: string;
    name?:   string;
    role?:   string;
  };

  if (!userId) {
    return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
  }
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 });
  }

  const sb = adminClient();
  const usersUpdate: Record<string, string> = {};
  if (name?.trim()) usersUpdate.name = name.trim();
  if (role)         usersUpdate.role = role;

  if (Object.keys(usersUpdate).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
  }

  // 1) users 테이블 UPDATE 시도
  const { data: updatedRows, error: updateErr } = await sb
    .from('users')
    .update(usersUpdate)
    .eq('id', userId)
    .select('id, name, role');

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 0 rows → users 테이블에 행 없음 (카카오/소셜 가입 등)
  // → auth.users에서 email 조회 + profiles 닉네임 조회 후 INSERT
  if (!updatedRows || updatedRows.length === 0) {
    // auth.users 에서 email 가져오기 (NOT NULL 컬럼)
    const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(userId);
    if (authErr || !authUser?.user) {
      return NextResponse.json(
        { error: `auth 유저 조회 실패: ${authErr?.message ?? '없음'}` },
        { status: 500 },
      );
    }
    const email = authUser.user.email ?? authUser.user.user_metadata?.email ?? '';

    // profiles 에서 닉네임 가져오기 (name 미제공 시 fallback)
    const { data: prof } = await sb
      .from('profiles')
      .select('nickname')
      .eq('id', userId)
      .maybeSingle();

    const insertRow: Record<string, string> = {
      id:    userId,
      email: email,
      name:  usersUpdate.name ?? prof?.nickname ?? authUser.user.user_metadata?.full_name ?? '(이름 없음)',
      role:  usersUpdate.role ?? 'customer',
    };

    const { data: inserted, error: insertErr } = await sb
      .from('users')
      .insert(insertRow)
      .select('id, name, role');

    if (insertErr) {
      return NextResponse.json(
        { error: `users 행 생성 실패: ${insertErr.message}` },
        { status: 500 },
      );
    }

    // profiles nickname 동기화
    if (usersUpdate.name) {
      await sb.from('profiles').update({ nickname: usersUpdate.name }).eq('id', userId);
    }

    return NextResponse.json({ ok: true, created: true, updated: inserted?.[0] });
  }

  // 2) profiles 테이블 nickname 동기화 (있을 경우에만)
  if (name?.trim()) {
    await sb
      .from('profiles')
      .update({ nickname: name.trim() })
      .eq('id', userId);
    // 에러 무시 — profiles 없는 유저도 있음
  }

  return NextResponse.json({ ok: true, updated: updatedRows[0] });
}
