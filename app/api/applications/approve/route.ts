/**
 * POST /api/applications/approve
 * body: { id: string }
 *
 * 가게 등록 신청 승인 — service_role 키로 RLS 우회하여 stores 테이블에 저장
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

  const sb = adminClient();

  // 1. 신청 내용 조회
  const { data: app, error: fetchErr } = await sb
    .from('store_applications')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !app) {
    return NextResponse.json({ error: '신청 내용을 찾을 수 없습니다' }, { status: 404 });
  }

  if (app.status === 'approved') {
    return NextResponse.json({ error: '이미 승인된 신청입니다' }, { status: 409 });
  }

  // 2. stores 테이블에 insert (service_role → RLS 우회)
  const { data: store, error: insertErr } = await sb
    .from('stores')
    .insert({
      name:             app.store_name,
      category:         app.category,
      address:          app.address,
      phone:            app.phone,
      description:      app.description ?? null,
      latitude:         app.latitude ?? null,
      longitude:        app.longitude ?? null,
      is_active:        true,
      instagram_url:    app.instagram_url ?? null,
      naver_place_url:  app.naver_place_url ?? null,
      postcode:         app.postcode ?? null,
      address_detail:   app.address_detail ?? null,
    })
    .select('id')
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: `stores 등록 실패: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // 3. 신청 상태 → approved + store_id 연결
  const { error: updateErr } = await sb
    .from('store_applications')
    .update({
      status:      'approved',
      store_id:    store.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json(
      { error: `상태 업데이트 실패: ${updateErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, store_id: store.id });
}
