/**
 * POST /api/applications/approve
 * body: { id: string }
 *
 * 가게 등록 신청 승인 — service_role 키로 RLS 우회하여 stores 테이블에 저장
 * + 신청자에게 Expo 푸시 알림 발송
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** 특정 user_id의 Expo 푸시 토큰 조회 */
async function getPushToken(sb: ReturnType<typeof adminClient>, userId: string): Promise<string | null> {
  const { data } = await sb
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .not('token', 'is', null)
    .single();
  return data?.token ?? null;
}

/** Expo Push API 단건 발송 */
async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: token, sound: 'default', title, body, data: data ?? {} }),
    });
    const result = await res.json();
    return result?.data?.status === 'ok';
  } catch (e) {
    console.error('[push] Expo 발송 실패:', (e as Error).message);
    return false;
  }
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

  // 3-1. coupon_draft → coupons 테이블에 첫 번째 쿠폰 자동 생성
  let couponId: string | null = null;
  if (app.coupon_draft) {
    const draft = app.coupon_draft as {
      discount_type:  string;
      title:          string;
      discount_value: number;
      free_item_name: string | null;
      expires_at:     string | null;
      total_quantity: number;
    };
    const fallbackExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: coupon, error: couponErr } = await sb
      .from('coupons')
      .insert({
        store_id:       store.id,
        title:          draft.title,
        discount_type:  draft.discount_type,
        discount_value: draft.discount_value ?? 0,
        free_item_name: draft.free_item_name ?? null,
        total_quantity: draft.total_quantity ?? 100,
        issued_count:   0,
        is_active:      true,
        expires_at:     draft.expires_at ?? fallbackExpiry,
      })
      .select('id')
      .single();
    if (couponErr) {
      console.error('[applications/approve] coupon 생성 실패:', couponErr.message);
    } else {
      couponId = coupon?.id ?? null;
      console.log('[applications/approve] 첫 쿠폰 생성 완료:', couponId);
    }
  }

  // 4. 신청자 푸시 알림 발송 (best-effort)
  let pushSent = false;
  if (app.owner_id) {
    const token = await getPushToken(sb, app.owner_id);
    if (token) {
      pushSent = await sendExpoPush(
        token,
        '🎉 가게 등록이 승인되었어요!',
        `"${app.store_name}" 가게가 언니픽에 등록되었습니다. 지금 바로 사장님 페이지를 확인해보세요!`,
        { type: 'store_approved', store_id: store.id },
      );
    }
  }

  return NextResponse.json({ ok: true, store_id: store.id, coupon_id: couponId, push_sent: pushSent });
}
