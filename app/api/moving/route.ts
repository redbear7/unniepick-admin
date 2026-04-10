import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// POST /api/moving — 이사 견적 요청 저장
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 });
  }

  const { user_name, user_phone, type, from_address, to_address, move_date, items } =
    body as Record<string, unknown>;

  if (!user_name || typeof user_name !== 'string' || !user_name.trim()) {
    return NextResponse.json({ error: '이름을 입력해 주세요' }, { status: 400 });
  }
  if (!user_phone || typeof user_phone !== 'string' || !user_phone.trim()) {
    return NextResponse.json({ error: '연락처를 입력해 주세요' }, { status: 400 });
  }
  const phoneRegex = /^[0-9\-+\s]{7,20}$/;
  if (!phoneRegex.test(user_phone.trim())) {
    return NextResponse.json({ error: '연락처 형식이 올바르지 않습니다' }, { status: 400 });
  }
  if (!type || typeof type !== 'string' || !type.trim()) {
    return NextResponse.json({ error: '이사 유형을 선택해 주세요' }, { status: 400 });
  }
  if (!from_address || typeof from_address !== 'string' || !from_address.trim()) {
    return NextResponse.json({ error: '출발지를 입력해 주세요' }, { status: 400 });
  }
  if (!to_address || typeof to_address !== 'string' || !to_address.trim()) {
    return NextResponse.json({ error: '도착지를 입력해 주세요' }, { status: 400 });
  }
  if (!move_date || typeof move_date !== 'string' || !move_date.trim()) {
    return NextResponse.json({ error: '이사 날짜를 입력해 주세요' }, { status: 400 });
  }

  const { data, error } = await sb()
    .from('moving_requests')
    .insert({
      user_name: user_name.trim(),
      user_phone: user_phone.trim(),
      type: type.trim(),
      from_address: from_address.trim(),
      to_address: to_address.trim(),
      move_date: move_date.trim(),
      items: Array.isArray(items) ? items : [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// GET /api/moving — 관리자 전용
export async function GET() {
  const { data, error } = await sb()
    .from('moving_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
