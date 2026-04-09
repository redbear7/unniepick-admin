import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET /api/tts/policy — 전체 정책 목록 반환 (sort_order 순)
export async function GET() {
  const { data, error } = await sb()
    .from('tts_policies')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json(data, { headers: CORS });
}

// PATCH /api/tts/policy — 가게에 정책 할당
// body: { store_id: string, policy_id: string | null }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { store_id, policy_id } = body as { store_id: string; policy_id: string | null };

  if (!store_id) {
    return NextResponse.json({ error: 'store_id 가 필요합니다' }, { status: 400, headers: CORS });
  }

  const { error } = await sb()
    .from('stores')
    .update({ tts_policy_id: policy_id ?? null })
    .eq('id', store_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json({ ok: true }, { headers: CORS });
}

// PUT /api/tts/policy — 정책 속성 수정 (daily_char_limit, description)
// body: { id: string, daily_char_limit?: number, description?: string }
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, daily_char_limit, description } = body as { id: string; daily_char_limit?: number; description?: string };
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400, headers: CORS });
  const updates: Record<string, unknown> = {};
  if (daily_char_limit !== undefined) updates.daily_char_limit = daily_char_limit;
  if (description !== undefined) updates.description = description;
  const { error } = await sb().from('tts_policies').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  return NextResponse.json({ ok: true }, { headers: CORS });
}
