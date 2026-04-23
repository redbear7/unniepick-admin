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

  // 1) users 테이블 업데이트 (.select() 로 실제 반영 여부 확인)
  const { data: updatedRows, error: usersErr } = await sb
    .from('users')
    .update(usersUpdate)
    .eq('id', userId)
    .select('id, name, role');

  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }

  // 0 rows → userId가 users 테이블에 없음
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { error: 'users 테이블에 해당 유저가 없어요. DB를 직접 확인해주세요.' },
      { status: 404 },
    );
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
