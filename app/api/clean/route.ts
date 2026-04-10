import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// POST /api/clean — 청소 상담 요청 저장
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 });
  }

  const { name, phone, email, address, area, content } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: '이름을 입력해 주세요' }, { status: 400 });
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return NextResponse.json({ error: '연락처를 입력해 주세요' }, { status: 400 });
  }
  const phoneRegex = /^[0-9\-+\s]{7,20}$/;
  if (!phoneRegex.test(phone.trim())) {
    return NextResponse.json({ error: '연락처 형식이 올바르지 않습니다' }, { status: 400 });
  }
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다' }, { status: 400 });
    }
  }
  if (!address || typeof address !== 'string' || !address.trim()) {
    return NextResponse.json({ error: '청소 장소를 입력해 주세요' }, { status: 400 });
  }

  const { data, error } = await sb()
    .from('clean_requests')
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      email: email && typeof email === 'string' && email.trim() ? email.trim() : null,
      address: address.trim(),
      area: area && typeof area === 'string' && area.trim() ? area.trim() : null,
      content: content && typeof content === 'string' && content.trim() ? content.trim() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// GET /api/clean — 관리자 전용
export async function GET() {
  const { data, error } = await sb()
    .from('clean_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
