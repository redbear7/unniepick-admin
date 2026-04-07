/**
 * POST /api/dev/reset-owners
 * 더미 사장님 데이터 초기화
 * - email이 @test.unnipick.dev 인 users 삭제
 * - 연결된 owner_pins 삭제
 * - stores.owner_id null 처리
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST() {
  const supabase = sb();

  // 1. 더미 유저 ID 조회
  const { data: dummies } = await supabase
    .from('users')
    .select('id')
    .like('email', '%@test.unnipick.dev');

  const ids = (dummies ?? []).map(u => u.id);

  if (ids.length > 0) {
    // 2. owner_pins 삭제
    await supabase.from('owner_pins').delete().in('user_id', ids);

    // 3. stores.owner_id 연결 해제
    await supabase.from('stores').update({ owner_id: null }).in('owner_id', ids);

    // 4. users 삭제
    await supabase.from('users').delete().in('id', ids);
  }

  return NextResponse.json({ deleted: ids.length });
}
