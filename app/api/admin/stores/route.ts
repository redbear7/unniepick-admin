/**
 * /api/admin/stores
 * 가게 관리 – service role 클라이언트 사용 (RLS bypass)
 *
 * DELETE  body: { id: string }            → 가게 삭제
 * PATCH   body: { id: string, ...fields } → 가게 업데이트 (is_active 토글 등)
 * POST    body: { ...fields }             → 가게 등록 (insert)
 * PUT     body: { id: string, ...fields } → 가게 전체 수정 (update)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/* ── DELETE ─────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const sb = adminSb();

  // 연결된 쿠폰 등 먼저 삭제 (FK 에러 방지)
  await Promise.allSettled([
    sb.from('coupons').delete().eq('store_id', id),
    sb.from('store_visits').delete().eq('store_id', id),
  ]);

  const { error } = await sb.from('stores').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/* ── PATCH (부분 업데이트 – is_active 토글 등) ─────────── */
export async function PATCH(req: NextRequest) {
  const { id, ...fields } = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const { error } = await adminSb().from('stores').update(fields).eq('id', id as string);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/* ── POST (신규 등록) ───────────────────────────────────── */
export async function POST(req: NextRequest) {
  const fields = await req.json().catch(() => ({})) as Record<string, unknown>;

  const { data, error } = await adminSb().from('stores').insert(fields).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}

/* ── PUT (전체 수정) ────────────────────────────────────── */
export async function PUT(req: NextRequest) {
  const { id, ...fields } = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const { error } = await adminSb().from('stores').update(fields).eq('id', id as string);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
