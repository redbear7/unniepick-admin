import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, unit_count, location, user_name, user_phone, address, preferred_date, memo } = body;

  if (!type || !user_name?.trim() || !user_phone?.trim()) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
  }

  const { data, error } = await sb()
    .from('aircon_requests')
    .insert({
      type,
      unit_count: unit_count ?? 1,
      location: location ?? null,
      user_name: user_name.trim(),
      user_phone: user_phone.trim(),
      address: address ?? null,
      preferred_date: preferred_date ?? null,
      memo: memo ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
