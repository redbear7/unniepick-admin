/**
 * POST /api/restaurants/batch-register
 * 크롤링된 restaurants → stores 일괄 등록
 *
 * body: { naver_place_ids: string[] }
 * returns: { ok: true, registered: string[], skipped: string[], failed: { id: string; error: string }[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { naver_place_ids } = await req.json().catch(() => ({})) as {
    naver_place_ids?: string[];
  };

  if (!naver_place_ids?.length) {
    return NextResponse.json({ error: 'naver_place_ids 배열이 필요합니다' }, { status: 400 });
  }

  const sb = adminSb();

  // 1. restaurants 테이블에서 원본 데이터 조회
  const { data: rawRows, error: fetchErr } = await sb
    .from('restaurants')
    .select(
      'id, naver_place_id, name, category, address, phone, ' +
      'image_url, naver_place_url, instagram_url, ' +
      'latitude, longitude, visitor_review_count, is_active',
    )
    .in('naver_place_id', naver_place_ids);

  if (fetchErr) {
    return NextResponse.json({ error: (fetchErr as any).message ?? String(fetchErr) }, { status: 500 });
  }

  const rows = (rawRows as unknown) as Array<{
    id: string;
    naver_place_id: string;
    name: string;
    category: string | null;
    address: string | null;
    phone: string | null;
    image_url: string | null;
    naver_place_url: string | null;
    instagram_url: string | null;
    latitude: number | null;
    longitude: number | null;
    visitor_review_count: number | null;
    is_active: boolean | null;
  }> | null;

  const foundIds = new Set((rows ?? []).map(r => r.naver_place_id));
  const notFound = naver_place_ids.filter(id => !foundIds.has(id));

  const registered: string[] = [];
  const failed: { id: string; error: string }[] = [];

  // 2. stores 테이블에 upsert
  if (rows && rows.length > 0) {
    const payload = rows.map(r => ({
      name:            r.name,
      category:        r.category   || null,
      address:         r.address    || null,
      phone:           r.phone      || null,
      naver_place_id:  r.naver_place_id,
      naver_place_url: r.naver_place_url || null,
      naver_thumbnail: r.image_url  || null,
      instagram_url:   r.instagram_url   || null,
      latitude:        r.latitude   ?? null,
      longitude:       r.longitude  ?? null,
      review_count:    r.visitor_review_count ?? 0,
      is_active:       r.is_active  ?? true,
      is_closed:       false,
    }));

    const { error: upsertErr } = await sb
      .from('stores')
      .upsert(payload, { onConflict: 'naver_place_id', ignoreDuplicates: false });

    if (upsertErr) {
      // 전체 실패
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    for (const r of rows) registered.push(r.naver_place_id);
  }

  // notFound는 restaurants 테이블에 없던 것
  for (const id of notFound) {
    failed.push({ id, error: 'restaurants 테이블에 없음' });
  }

  return NextResponse.json({
    ok: true,
    registered,
    failed,
    summary: `${registered.length}개 등록, ${failed.length}개 실패`,
  });
}
