/**
 * POST /api/dev/clean-stores
 * 가게 관련 더미 데이터 전체 초기화
 *
 * 삭제 순서 (FK 순):
 *  1. coupons          (store_id FK)
 *  2. store_posts      (store_id FK)
 *  3. store_announcements (store_id FK)
 *  4. store_visits     (store_id FK) — 테이블 없으면 무시
 *  5. fish_voices      (store_id FK) — 테이블 없으면 무시
 *  6. stores           (메인)
 *  7. 더미 owner_pins  (@test.unnipick.dev 유저)
 *  8. 더미 users       (@test.unnipick.dev 이메일)
 *
 * 일반 유저(리뷰어 등) 및 restaurants(크롤링 원본)은 건드리지 않음.
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
  const log: string[] = [];

  // 전체 store id 목록
  const { data: allStores } = await supabase.from('stores').select('id');
  const storeIds = (allStores ?? []).map(s => s.id as string);
  log.push(`stores 대상: ${storeIds.length}개`);

  if (storeIds.length > 0) {
    // 1. coupons
    await supabase.from('coupons').delete().in('store_id', storeIds);
    log.push('coupons 삭제 완료');

    // 2. store_posts
    await supabase.from('store_posts').delete().in('store_id', storeIds);
    log.push('store_posts 삭제 완료');

    // 3. store_announcements
    await supabase.from('store_announcements').delete().in('store_id', storeIds);
    log.push('store_announcements 삭제 완료');

    // 4. store_visits (없으면 무시)
    try {
      await supabase.from('store_visits').delete().in('store_id', storeIds);
      log.push('store_visits 삭제 완료');
    } catch { log.push('store_visits: 테이블 없음(무시)'); }

    // 5. fish_voices (없으면 무시)
    try {
      await supabase.from('fish_voices').delete().in('store_id', storeIds);
      log.push('fish_voices 삭제 완료');
    } catch { log.push('fish_voices: 테이블 없음(무시)'); }

    // 6. stores
    const { error: storeErr } = await supabase.from('stores').delete().in('id', storeIds);
    if (storeErr) log.push(`stores 삭제 실패: ${storeErr.message}`);
    else log.push(`stores 삭제: ${storeIds.length}개`);
  }

  // 7-8. 더미 owner 정리 (@test.unnipick.dev)
  const { data: dummies } = await supabase
    .from('users').select('id').like('email', '%@test.unnipick.dev');
  const dummyIds = (dummies ?? []).map(u => u.id as string);
  log.push(`더미 유저 대상: ${dummyIds.length}개`);

  if (dummyIds.length > 0) {
    await supabase.from('owner_pins').delete().in('user_id', dummyIds);
    await supabase.from('users').delete().in('id', dummyIds);
    log.push('더미 owner_pins / users 삭제 완료');
  }

  return NextResponse.json({ ok: true, log });
}
