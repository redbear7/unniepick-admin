/**
 * GET  /api/recommendations?page=1&limit=10
 * POST /api/recommendations  { place_id, place_name, place_category, place_address,
 *                              place_image_url, source, menu_items, recommendation_text }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit = Math.min(20, parseInt(searchParams.get('limit') ?? '10'));
  const from  = (page - 1) * limit;

  const { data, error, count } = await db()
    .from('user_recommendations')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count ?? 0, page, limit });
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
          place_image_url, source, menu_items, recommendation_text } = body;

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
      menu_items: menu_items ?? [],
      recommendation_text: recommendation_text ?? '',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 랜덤 포인트 지급 (10 ~ 50)
  const points = Math.floor(Math.random() * 41) + 10;
  await admin.from('user_points').insert({
    user_id:      user.id,
    points,
    reason:       '추천맛집 등록',
    reference_id: data.id,
  }).then(() => {}); // 포인트 실패해도 응답은 성공

  return NextResponse.json({ data, points_earned: points });
}
