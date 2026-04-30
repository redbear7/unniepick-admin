/**
 * /api/admin/coupons
 * 가게별 쿠폰 CRUD — service role 클라이언트 사용
 *
 * GET    ?store_id=xxx         → 가게 쿠폰 목록
 * POST   { store_id, ...fields } → 쿠폰 생성
 * PATCH  { id, ...fields }       → 쿠폰 수정
 * DELETE { id }                  → 쿠폰 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logActivity } from '@/lib/server/activity';

function adminSb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('store_id');
  if (!storeId) return NextResponse.json({ error: 'store_id 필요' }, { status: 400 });

  const { data, error } = await adminSb()
    .from('coupons')
    .select('id, title, discount_type, discount_value, free_item_name, total_quantity, issued_count, is_active, expires_at, created_at, target_segment, min_visit_count, min_people, min_order_amount, time_start, time_end, stackable, is_featured')
    .eq('store_id', storeId)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { store_id, title, discount_type, discount_value, total_quantity, expires_at, target_segment, min_visit_count, is_active } = body;

    if (!store_id || !title?.trim() || !discount_type || !discount_value || !expires_at) {
      return NextResponse.json({ error: '필수 필드 누락 (store_id, title, discount_type, discount_value, expires_at)' }, { status: 400 });
    }

    const {
      free_item_name, min_people, min_order_amount,
      time_start, time_end, stackable, is_featured,
    } = body;

    const sb = adminSb();
    const { data, error } = await sb
      .from('coupons')
      .insert({
        store_id,
        title:            title.trim(),
        discount_type,
        discount_value:   ['free_item', 'bogo'].includes(discount_type) ? 0 : Number(discount_value),
        free_item_name:   discount_type === 'free_item' ? (free_item_name ?? null) : null,
        total_quantity:   Number(total_quantity ?? 0),
        issued_count:     0,
        expires_at:       new Date(expires_at).toISOString(),
        is_active:        is_active ?? true,
        target_segment:   target_segment ?? 'all',
        min_visit_count:  target_segment === 'returning' ? (min_visit_count ?? 2) : null,
        min_people:       Number(min_people ?? 1),
        min_order_amount: Number(min_order_amount ?? 0),
        time_start:       time_start || null,
        time_end:         time_end   || null,
        stackable:        stackable  ?? false,
        is_featured:      is_featured ?? false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logActivity(sb, {
      event_type: 'coupon_created',
      actor_type: 'owner',
      store_id,
      coupon_id: data.id,
      source_table: 'coupons',
      source_id: data.id,
      title: '사장님 쿠폰 발행',
      detail: data.title,
      metadata: {
        discount_type,
        total_quantity: Number(total_quantity ?? 0),
      },
    }).catch(e => console.error('[activity/coupon_created]', e.message));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...fields } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    // expires_at 문자열이면 ISO 변환
    if (fields.expires_at && !fields.expires_at.includes('T')) {
      fields.expires_at = new Date(fields.expires_at).toISOString();
    }

    const { error } = await adminSb().from('coupons').update(fields).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const { error } = await adminSb().from('coupons').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
