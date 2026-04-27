/**
 * GET  /api/recommendations?page=1&limit=10&sort=recent|likes|distance&lat=&lng=
 * POST /api/recommendations  { place_id, place_name, place_category, place_address,
 *                              place_image_url, source, menu_items, recommendation_text,
 *                              place_lat, place_lng }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Haversine 거리 계산 (km)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit = Math.min(20, parseInt(searchParams.get('limit') ?? '10'));
  const sort  = searchParams.get('sort') ?? 'recent'; // recent | likes | distance
  const userLat = parseFloat(searchParams.get('lat') ?? '');
  const userLng = parseFloat(searchParams.get('lng') ?? '');
  const from  = (page - 1) * limit;

  // 거리순: 전체 페치 후 서버에서 정렬 (lat/lng 없으면 등록순 fallback)
  if (sort === 'distance' && !isNaN(userLat) && !isNaN(userLng)) {
    const { data: all, error, count } = await db()
      .from('user_recommendations')
      .select('*', { count: 'exact' })
      .not('place_lat', 'is', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const sorted = (all ?? [])
      .map(r => ({ ...r, _dist: haversine(userLat, userLng, r.place_lat, r.place_lng) }))
      .sort((a, b) => a._dist - b._dist)
      .slice(from, from + limit)
      .map(({ _dist, ...r }) => r);

    return NextResponse.json({ data: sorted, total: count ?? 0, page, limit, sort });
  }

  const orderCol = sort === 'likes' ? 'like_count' : 'created_at';

  const { data, error, count } = await db()
    .from('user_recommendations')
    .select('*', { count: 'exact' })
    .order(orderCol, { ascending: false })
    .range(from, from + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count ?? 0, page, limit, sort });
}

export async function POST(req: NextRequest) {
  // 인증 헤더에서 user 추출
  const auth  = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: '인증 실패' }, { status: 401 });

  const body = await req.json();
  const { place_id, place_name, place_category, place_address,
          place_image_url, source, menu_items, recommendation_text,
          place_lat, place_lng } = body;

  if (!place_id || !place_name) {
    return NextResponse.json({ error: '가게 정보가 필요합니다' }, { status: 400 });
  }

  // 하루 10개 작성 제한
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await db()
    .from('user_recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString());
  if ((todayCount ?? 0) >= 10) {
    return NextResponse.json({ error: '하루 최대 10개까지 작성할 수 있어요' }, { status: 429 });
  }

  // 전화번호 마스킹 표시 (010-****-1234)
  const phone = user.phone ?? '';
  const display = phone.length >= 8
    ? `${phone.slice(0,3)}-****-${phone.slice(-4)}`
    : '익명';

  const { data, error } = await db()
    .from('user_recommendations')
    .insert({
      user_id: user.id,
      user_display: display,
      place_id, place_name, place_category, place_address,
      place_image_url, source: source ?? 'kakao',
      place_lat: place_lat ?? null, place_lng: place_lng ?? null,
      menu_items: menu_items ?? [],
      recommendation_text: recommendation_text ?? '',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 랜덤 포인트 지급 (10 ~ 50)
  const points = Math.floor(Math.random() * 41) + 10;
  await db().from('user_points').insert({
    user_id:      user.id,
    points,
    reason:       '추천맛집 등록',
    reference_id: data.id,
  }).then(() => {}); // 포인트 실패해도 응답은 성공

  return NextResponse.json({ data, points_earned: points });
}
