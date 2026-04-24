/**
 * POST /api/admin/run-migration
 * ⚠️  일회성 임시 엔드포인트 — 사용 후 삭제
 *
 * users_role_check 제약조건에 'developer' 추가
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

  // 1) 기존 users_role_check 제약조건 삭제
  const { error: dropErr } = await sb.rpc('exec_sql' as any, {
    sql: 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;',
  }).catch(() => ({ error: { message: 'rpc not available' } }));

  // rpc 없으면 직접 시도
  if (dropErr?.message === 'rpc not available') {
    // Supabase REST API로 직접 실행 불가 — 아래 URL을 사용해주세요
    return NextResponse.json({
      ok: false,
      message: 'RPC 미지원. 아래 SQL을 Supabase 대시보드 SQL Editor에서 직접 실행해주세요.',
      sql: [
        "ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;",
        "ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'owner', 'admin', 'superadmin', 'developer'));",
      ],
    });
  }

  if (dropErr) {
    return NextResponse.json({ ok: false, step: 'drop', error: dropErr.message });
  }

  // 2) 새 제약조건 추가 (developer 포함)
  const { error: addErr } = await sb.rpc('exec_sql' as any, {
    sql: "ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'owner', 'admin', 'superadmin', 'developer'));",
  });

  if (addErr) {
    return NextResponse.json({ ok: false, step: 'add', error: addErr.message });
  }

  return NextResponse.json({ ok: true, message: '✅ users_role_check 제약조건 업데이트 완료' });
}
