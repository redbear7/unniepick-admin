import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — 전체 목록 (어드민)
export async function GET() {
  const { data, error } = await adminClient()
    .from('consult_chips')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chips: data ?? [] });
}

// POST — 칩 추가
export async function POST(req: NextRequest) {
  const { label, message, sort_order } = await req.json();
  if (!label?.trim() || !message?.trim())
    return NextResponse.json({ error: '라벨과 메시지를 입력해주세요.' }, { status: 400 });

  const { data, error } = await adminClient()
    .from('consult_chips')
    .insert({ label: label.trim(), message: message.trim(), sort_order: sort_order ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chip: data });
}
