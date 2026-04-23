/**
 * POST /api/admin/run-migration
 * ⚠️  일회성 임시 엔드포인트 — 사용 후 삭제
 *
 * users.role 컬럼의 CHECK 제약조건을 확인하고 제거/재생성합니다.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST() {
  const sb = adminClient();
  const log: string[] = [];

  // Step 1: users 테이블에서 샘플 유저 1명 가져오기
  const { data: user, error: userErr } = await sb
    .from('users')
    .select('id, name, role')
    .limit(1)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: `유저 조회 실패: ${userErr?.message}` });
  }
  log.push(`✅ 샘플 유저: ${user.name} (role: ${user.role})`);

  // Step 2: developer 로 업데이트 시도
  const { data: updated, error: updateErr } = await sb
    .from('users')
    .update({ role: 'developer' })
    .eq('id', user.id)
    .select('id, role');

  if (updateErr) {
    log.push(`❌ developer 업데이트 실패: ${updateErr.message} [code: ${updateErr.code}]`);
    log.push(`⚠️  DB에 CHECK 제약조건이 있습니다. Supabase 대시보드 → Table Editor → users 테이블에서 role 컬럼 제약을 직접 수정하세요.`);
    return NextResponse.json({ ok: false, log });
  }

  if (!updated || updated.length === 0) {
    log.push(`❌ 업데이트 행 없음 (0 rows) — users 테이블에 해당 ID가 없음`);
    return NextResponse.json({ ok: false, log });
  }

  log.push(`✅ developer 업데이트 성공: ${JSON.stringify(updated[0])}`);

  // Step 3: 원래 role로 복구
  await sb.from('users').update({ role: user.role }).eq('id', user.id);
  log.push(`🔄 원래 역할(${user.role})로 복구 완료`);

  return NextResponse.json({ ok: true, log });
}
