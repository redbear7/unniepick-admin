/**
 * PATCH /api/owner/store
 * 사장님 가게 정보 수정 — service role로 RLS 우회
 * body: { store_id, owner_user_id, name, address, phone, category, image_url }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    store_id:      string;
    owner_user_id: string;
    name:          string;
    address?:      string | null;
    phone?:        string | null;
    category?:     string | null;
    image_url?:    string | null;
  };

  if (!body.store_id || !body.owner_user_id) {
    return NextResponse.json({ error: 'store_id, owner_user_id 필요' }, { status: 400 });
  }

  const sb = adminSb();

  // owner_id 검증 — 요청자가 실제 해당 가게 사장님인지 확인
  const { data: store, error: findErr } = await sb
    .from('stores')
    .select('id')
    .eq('id', body.store_id)
    .eq('owner_id', body.owner_user_id)
    .maybeSingle();

  if (findErr || !store) {
    return NextResponse.json({ error: '권한이 없거나 가게를 찾을 수 없습니다.' }, { status: 403 });
  }

  const { error } = await sb
    .from('stores')
    .update({
      name:      body.name?.trim()      || null,
      address:   body.address?.trim()   || null,
      phone:     body.phone?.trim()     || null,
      category:  body.category?.trim()  || null,
      image_url: body.image_url?.trim() || null,
    })
    .eq('id', body.store_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
