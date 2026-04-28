/**
 * POST /api/restaurants/batch-register
 * 크롤링된 restaurants → stores 일괄 등록 (비활성 상태로 즉시 등록)
 *
 * body: { restaurant_ids: string[] }  ← restaurants 테이블의 UUID
 * returns: { ok: true, registered: string[], failed: { id: string; error: string }[] }
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
  const { restaurant_ids } = await req.json().catch(() => ({})) as {
    restaurant_ids?: string[];
  };

  if (!restaurant_ids?.length) {
    return NextResponse.json({ error: 'restaurant_ids 배열이 필요합니다' }, { status: 400 });
  }

  const sb = adminSb();

  // 1. restaurants 테이블에서 원본 데이터 조회 (UUID 기준)
  const { data: rawRows, error: fetchErr } = await sb
    .from('restaurants')
    .select(
      'id, naver_place_id, kakao_place_id, name, category, address, phone, ' +
      'image_url, naver_place_url, kakao_place_url, instagram_url, ' +
      'latitude, longitude, visitor_review_count',
    )
    .in('id', restaurant_ids);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const rows = (rawRows ?? []) as unknown as Array<{
    id: string;
    naver_place_id: string | null;
    kakao_place_id: string | null;
    name: string;
    category: string | null;
    address: string | null;
    phone: string | null;
    image_url: string | null;
    naver_place_url: string | null;
    kakao_place_url: string | null;
    instagram_url: string | null;
    latitude: number | null;
    longitude: number | null;
    visitor_review_count: number | null;
  }>;

  const registered: string[] = [];
  const failed: { id: string; error: string }[] = [];

  // 2. stores 테이블에 upsert (비활성 상태로 등록)
  if (rows.length > 0) {
    const payload = rows.map(r => {
      // stores.naver_place_id: 네이버 ID 우선, 없으면 카카오 synthetic key
      const storeNaverId = r.naver_place_id ?? (r.kakao_place_id ? `kakao_${r.kakao_place_id}` : null);
      return {
        name:            r.name,
        category:        r.category          || '기타',
        address:         r.address           || null,
        phone:           r.phone             || null,
        naver_place_id:  storeNaverId,
        naver_place_url: r.naver_place_url   || r.kakao_place_url || null,
        naver_thumbnail: r.image_url         || null,
        instagram_url:   r.instagram_url     || null,
        latitude:        r.latitude          ?? null,
        longitude:       r.longitude         ?? null,
        review_count:    r.visitor_review_count ?? 0,
        is_active:       false,   // 비활성 상태로 등록 — 관리자가 직접 활성화
        is_closed:       false,
      };
    }).filter(r => r.naver_place_id != null); // naver_place_id 없으면 upsert 불가

    if (payload.length > 0) {
      const { error: upsertErr } = await sb
        .from('stores')
        .upsert(payload, { onConflict: 'naver_place_id', ignoreDuplicates: false });

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    for (const r of rows) {
      if (r.naver_place_id || r.kakao_place_id) {
        registered.push(r.id); // restaurant UUID 반환
      } else {
        failed.push({ id: r.id, error: 'naver_place_id / kakao_place_id 모두 없음' });
      }
    }
  }

  // 요청했지만 DB에 없던 ID
  const foundIds = new Set(rows.map(r => r.id));
  for (const id of restaurant_ids) {
    if (!foundIds.has(id)) failed.push({ id, error: 'restaurants 테이블에 없음' });
  }

  return NextResponse.json({
    ok: true,
    registered,  // restaurant UUID 배열
    failed,
    summary: `${registered.length}개 등록, ${failed.length}개 실패`,
  });
}
