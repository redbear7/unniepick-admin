/**
 * POST /api/dev/seed-owners
 * 테스트용 더미 사장님 회원 생성 + PIN 부여
 * ⚠️  개발/테스트 전용 — 운영 배포 전 반드시 제거 또는 보호 필요
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function hashPin(pin: string) {
  return crypto.createHash('sha256').update(`unnipick:${pin}`).digest('hex');
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { store_ids } = await req.json() as { store_ids: string[] };

  if (!store_ids || store_ids.length === 0) {
    return NextResponse.json({ error: 'store_ids 배열이 필요합니다.' }, { status: 400 });
  }

  const supabase = sb();

  // 선택한 매장 조회
  const { data: stores, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, phone, owner_id')
    .in('id', store_ids);

  if (storeErr || !stores) {
    return NextResponse.json({ error: '매장 조회 실패: ' + storeErr?.message }, { status: 500 });
  }

  const results: Array<{ store: string; owner_name: string; phone: string; pin: string; status: string }> = [];

  for (const store of stores) {
    const pin = '123456';
    const ownerName = `${store.name} 사장님`;
    // 테스트용 고정 번호 (매장 ID 앞 8자리 기반, 입력 검증 우회)
    const phoneNum = `010${store.id.replace(/-/g, '').slice(0, 8)}`;

    try {
      // 1. users 테이블에 owner 회원 upsert (phone 기준)
      const { data: user, error: uErr } = await supabase
        .from('users')
        .upsert(
          { name: ownerName, phone: phoneNum, role: 'owner' },
          { onConflict: 'phone', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (uErr || !user) throw new Error('회원 생성 실패: ' + uErr?.message);

      // 2. stores.owner_id 연결
      await supabase
        .from('stores')
        .update({ owner_id: user.id })
        .eq('id', store.id);

      // 3. owner_pins upsert
      await supabase
        .from('owner_pins')
        .upsert(
          {
            user_id:          user.id,
            pin_hash:         hashPin(pin),
            pin_changes:      0,
            pin_change_month: '',
            is_active:        true,
          },
          { onConflict: 'user_id' }
        );

      results.push({ store: store.name, owner_name: ownerName, phone: phoneNum, pin, status: 'ok' });
    } catch (e) {
      results.push({ store: store.name, owner_name: ownerName, phone: phoneNum, pin, status: (e as Error).message });
    }
  }

  return NextResponse.json({ results });
}
