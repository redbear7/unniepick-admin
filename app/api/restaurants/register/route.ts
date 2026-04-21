import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

// 하위 호환용
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** 크롤링 결과를 restaurants 테이블에 직접 등록 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      naver_place_id,
      name,
      category,
      address,
      phone,
      image_url,
      instagram_url,
      website_url,
      naver_place_url,
      latitude,
      longitude,
      visitor_review_count,
      review_count,
      business_hours,
      business_hours_detail,
      menu_items,
      review_keywords,
      menu_keywords,
    } = body;

    if (!naver_place_id || !name) {
      return NextResponse.json({ error: 'naver_place_id와 name은 필수입니다' }, { status: 400 });
    }

    // 이미 restaurants에 존재하는지 확인
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('naver_place_id', naver_place_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'already_exists', message: `이미 등록된 업체입니다 (${existing.name})`, id: existing.id },
        { status: 409 },
      );
    }

    // restaurants 테이블에 insert
    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        naver_place_id,
        name,
        category: category ?? '',
        address: address ?? '',
        phone: phone ?? '',
        image_url: image_url ?? '',
        instagram_url: instagram_url ?? null,
        website_url: website_url ?? null,
        naver_place_url: naver_place_url ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        visitor_review_count: visitor_review_count ?? 0,
        review_count: review_count ?? 0,
        business_hours: business_hours ?? null,
        business_hours_detail: business_hours_detail ?? null,
        menu_items: JSON.stringify(menu_items ?? []),
        review_keywords: JSON.stringify(review_keywords ?? []),
        menu_keywords: JSON.stringify(menu_keywords ?? []),
        naver_verified: !!naver_place_url,
        is_active: true,
        crawled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[restaurants/register] insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[restaurants/register]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 기존 restaurants 레코드 수정 (service role — RLS 우회) */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { id, ...fields } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id 필수' }, { status: 400 });
    }

    const { error } = await adminSb()
      .from('restaurants')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[restaurants/register PATCH]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
