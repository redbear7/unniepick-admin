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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

/* ── DELETE ─────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json().catch(() => ({})) as { id?: string };
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const sb = adminSb();
    await Promise.allSettled([
      sb.from('coupons').delete().eq('store_id', id),
      sb.from('store_visits').delete().eq('store_id', id),
    ]);
    const { error } = await sb.from('stores').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/* ── PATCH (부분 업데이트 – is_active 토글 등) ─────────── */
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const { error } = await adminSb().from('stores').update(fields).eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/* ── POST (신규 등록) ───────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const fields = await req.json().catch(() => ({})) as Record<string, unknown>;
    const { data, error } = await adminSb().from('stores').insert(fields).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/* ── PUT (전체 수정) ────────────────────────────────────── */
export async function PUT(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const { error } = await adminSb().from('stores').update(fields).eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
