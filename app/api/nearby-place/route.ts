import { NextRequest, NextResponse } from 'next/server';

const CATEGORY_CODES = ['FD6', 'CE7', 'MT1', 'CS2', 'AD5', 'HP8', 'PM9'];
const FALLBACK_RADIUS = [80, 150, 250];

type KakaoNearbyDocument = {
  id?: string;
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  phone?: string;
  category_name?: string;
  y?: string;
  x?: string;
  place_url?: string;
  distance?: string;
};

function mapCategory(kakaoCategory: string): string {
  const normalized = kakaoCategory.trim();
  if (normalized.includes('카페')) return '카페';
  if (normalized.includes('베이커리') || normalized.includes('제과')) return '디저트';
  if (normalized.includes('한식')) return '한식';
  if (normalized.includes('중식')) return '중식';
  if (normalized.includes('일식')) return '일식';
  if (normalized.includes('양식')) return '양식';
  if (normalized.includes('분식')) return '분식';
  if (normalized.includes('술집') || normalized.includes('호프') || normalized.includes('바')) return '술집';
  if (normalized.includes('미용')) return '미용실';
  if (normalized.includes('네일')) return '네일샵';
  if (normalized.includes('의류')) return '의류';
  if (normalized.includes('헬스') || normalized.includes('필라테스') || normalized.includes('요가')) return '헬스/운동';
  if (normalized.includes('마트') || normalized.includes('편의점')) return '마트/편의점';
  return '기타';
}

export async function GET(req: NextRequest) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다' }, { status: 500 });
  }

  const x = req.nextUrl.searchParams.get('x');
  const y = req.nextUrl.searchParams.get('y');
  if (!x || !y) {
    return NextResponse.json({ error: 'x, y 좌표가 필요합니다' }, { status: 400 });
  }

  try {
    for (const radius of FALLBACK_RADIUS) {
      const params = new URLSearchParams({
        x,
        y,
        radius: String(radius),
        sort: 'distance',
        size: '15',
        category_group_code: CATEGORY_CODES.join(','),
      });

      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/category.json?${params.toString()}`,
        {
          headers: { Authorization: `KakaoAK ${key}` },
          next: { revalidate: 0 },
        },
      );

      if (!res.ok) {
        const err = await res.text();
        console.error('[nearby-place] API error', res.status, err);
        return NextResponse.json({ error: `카카오 API 오류 (${res.status})` }, { status: 502 });
      }

      const json = await res.json();
      const places = ((json.documents ?? []) as KakaoNearbyDocument[])
        .map((d) => ({
          kakao_id: d.id,
          place_name: d.place_name,
          address: d.road_address_name || d.address_name,
          road_address: d.road_address_name || null,
          phone: d.phone || null,
          category: mapCategory(d.category_name ?? ''),
          category_raw: d.category_name ?? '',
          latitude: d.y ? parseFloat(d.y) : null,
          longitude: d.x ? parseFloat(d.x) : null,
          place_url: d.place_url || null,
          distance_m: d.distance ? Number(d.distance) : null,
        }))
        .filter((place) => place.place_name && place.latitude !== null && place.longitude !== null);

      if (places.length > 0) {
        return NextResponse.json({ place: places[0], radius });
      }
    }

    return NextResponse.json({ place: null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
