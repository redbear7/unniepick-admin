import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// POST /api/loan — 대출 상담 신청 저장
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 });
  }

  const { user_name, user_phone, loan_type, loan_amount, purpose, bank_code, product_id, memo } =
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
  if (!loan_type || typeof loan_type !== 'string' || !loan_type.trim()) {
    return NextResponse.json({ error: '대출 유형을 선택해 주세요' }, { status: 400 });
  }

  const { data, error } = await sb()
    .from('loan_consultations')
    .insert({
      user_name: user_name.trim(),
      user_phone: user_phone.trim(),
      loan_type: loan_type.trim(),
      loan_amount: typeof loan_amount === 'number' ? loan_amount : null,
      purpose: typeof purpose === 'string' ? purpose.trim() : null,
      bank_code: typeof bank_code === 'string' ? bank_code.trim() : null,
      product_id: typeof product_id === 'number' ? product_id : null,
      memo: typeof memo === 'string' ? memo.trim() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// GET /api/loan — 관리자용 상담 신청 목록
export async function GET() {
  const { data, error } = await sb()
    .from('loan_consultations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
