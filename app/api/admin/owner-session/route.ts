/**
 * POST /api/admin/owner-session
 * 시샵 전용: PIN 검증 없이 owner 세션 데이터 발급 (가게관리 → 대시보드 바로가기)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: 'user_id가 필요합니다.' }, { status: 400 });
  }

  const supabase = sb();

  const { data: owner, error: uErr } = await supabase
    .from('users')
    .select('id, name, phone, created_at')
    .eq('id', user_id)
    .eq('role', 'owner')
    .single();

  if (uErr || !owner) {
    return NextResponse.json({ error: '사장님 계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: pin, error: pErr } = await supabase
    .from('owner_pins')
    .select('id, is_active')
    .eq('user_id', user_id)
    .single();

  if (pErr || !pin) {
    return NextResponse.json({ error: 'PIN이 부여되지 않은 계정입니다.' }, { status: 403 });
  }

  const session = {
    owner_pin_id: pin.id,
    user_id:      owner.id,
    name:         owner.name,
    phone:        owner.phone,
    created_at:   owner.created_at,
    exp:          Date.now() + 24 * 60 * 60 * 1000,
  };

  return NextResponse.json({ session });
}
