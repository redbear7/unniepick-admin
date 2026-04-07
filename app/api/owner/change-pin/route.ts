/**
 * POST /api/owner/change-pin
 * 월 2회 PIN 변경 허용. 매월 1일 카운트 초기화.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const MAX_CHANGES_PER_MONTH = 2;

function hashPin(pin: string) {
  return crypto.createHash('sha256').update(`unnipick:${pin}`).digest('hex');
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  const { owner_pin_id, current_pin, new_pin } = await req.json();

  if (!owner_pin_id || !current_pin || !new_pin) {
    return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(new_pin)) {
    return NextResponse.json({ error: '새 PIN은 6자리 숫자여야 합니다.' }, { status: 400 });
  }
  if (current_pin === new_pin) {
    return NextResponse.json({ error: '현재 PIN과 동일한 PIN으로 변경할 수 없습니다.' }, { status: 400 });
  }

  const sb = supabase();

  const { data: row, error } = await sb
    .from('owner_pins')
    .select('id, pin_hash, pin_changes, pin_change_month, is_active')
    .eq('id', owner_pin_id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!row.is_active) {
    return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 });
  }
  if (row.pin_hash !== hashPin(current_pin)) {
    return NextResponse.json({ error: '현재 PIN이 올바르지 않습니다.' }, { status: 401 });
  }

  // 월 리셋 처리
  const month = currentMonth();
  const changes = row.pin_change_month === month ? row.pin_changes : 0;

  if (changes >= MAX_CHANGES_PER_MONTH) {
    return NextResponse.json({
      error: `이번 달 PIN 변경 횟수(${MAX_CHANGES_PER_MONTH}회)를 모두 사용했습니다. 다음 달에 변경 가능합니다.`,
    }, { status: 429 });
  }

  const { error: updErr } = await sb
    .from('owner_pins')
    .update({
      pin_hash: hashPin(new_pin),
      pin_changes: changes + 1,
      pin_change_month: month,
      updated_at: new Date().toISOString(),
    })
    .eq('id', owner_pin_id);

  if (updErr) {
    return NextResponse.json({ error: 'PIN 변경에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    remaining_changes: MAX_CHANGES_PER_MONTH - (changes + 1),
  });
}
