/**
 * POST /api/owner/auth
 *
 * DB 테이블 (최초 1회 실행):
 * create table if not exists owner_pins (
 *   id              uuid default gen_random_uuid() primary key,
 *   user_id         text not null unique,
 *   pin_hash        text not null,
 *   pin_changes     int  default 0,
 *   pin_change_month text default '',
 *   is_active       boolean default true,
 *   created_at      timestamptz default now(),
 *   updated_at      timestamptz default now()
 * );
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function hashPin(pin: string) {
  return crypto.createHash('sha256').update(`unnipick:${pin}`).digest('hex');
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { phone, pin } = await req.json();
  if (!phone || !pin) {
    return NextResponse.json({ error: '전화번호와 PIN을 입력해주세요.' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN은 6자리 숫자입니다.' }, { status: 400 });
  }

  const sb = supabase();

  // 1. 사용자 조회 (role=owner)
  const { data: user, error: uErr } = await sb
    .from('users')
    .select('id, name, phone, role, created_at')
    .eq('phone', phone)
    .eq('role', 'owner')
    .single();

  if (uErr || !user) {
    return NextResponse.json({ error: '등록된 사장님 계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 2. owner_pins 조회
  const { data: ownerPin, error: pErr } = await sb
    .from('owner_pins')
    .select('id, pin_hash, is_active')
    .eq('user_id', user.id)
    .single();

  if (pErr || !ownerPin) {
    return NextResponse.json({ error: 'PIN이 아직 부여되지 않은 계정입니다. 관리자에게 문의하세요.' }, { status: 403 });
  }
  if (!ownerPin.is_active) {
    return NextResponse.json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, { status: 403 });
  }

  // 3. PIN 검증
  if (ownerPin.pin_hash !== hashPin(pin)) {
    return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 });
  }

  return NextResponse.json({
    owner_pin_id: ownerPin.id,
    user_id: user.id,
    name: user.name,
    phone: user.phone,
    created_at: user.created_at,
  });
}
