/**
 * GET /api/kakao-place?q=검색어&x=lng&y=lat&page=1
 *
 * 카카오 로컬 API — 키워드 장소 검색
 * 결과: place_name, address, road_address, phone, category, lat, lng, kakao_id, place_url
 *
 * 필요 환경변수: KAKAO_REST_API_KEY
 */
import { NextRequest, NextResponse } from 'next/server';

/* ---- 카카오 카테고리 → 언니픽 카테고리 매핑 ---- */
const CAT_MAP: Record<string, string> = {
  '한식':         '한식',
  '중식':         '중식',
  '일식':         '일식',
  '양식':         '양식',
  '카페':         '카페',
  '제과':         '베이커리',
  '베이커리':     '베이커리',
  '술집':         '술집',
  '분식':         '분식',
  '패스트푸드':   '패스트푸드',
};

function mapCategory(kakaoCategory: string): string {
  const parts = kakaoCategory.split('>').map(s => s.trim());
  for (const part of parts.reverse()) {
    for (const [key, val] of Object.entries(CAT_MAP)) {
      if (part.includes(key)) return val;
    }
  }
  return '기타';
}

export async function GET(req: NextRequest) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다' }, { status: 500 });
  }

  const q    = req.nextUrl.searchParams.get('q')?.trim();
  const x    = req.nextUrl.searchParams.get('x');   // longitude (경도)
  const y    = req.nextUrl.searchParams.get('y');   // latitude  (위도)
  const page = req.nextUrl.searchParams.get('page') ?? '1';

  if (!q) return NextResponse.json({ error: '검색어(q)가 필요합니다' }, { status: 400 });

  const params = new URLSearchParams({
    query: q,
    page,
    size: '5',
    ...(x && y ? { x, y, sort: 'distance' } : {}),
  });

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
      {
        headers: { Authorization: `KakaoAK ${key}` },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[kakao-place] API error', res.status, err);
      return NextResponse.json({ error: `카카오 API 오류 (${res.status})` }, { status: 502 });
    }

    const json = await res.json();
    const places = (json.documents ?? []).map((d: any) => ({
      kakao_id:     d.id,
      place_name:   d.place_name,
      address:      d.road_address_name || d.address_name,
      road_address: d.road_address_name || null,
      jibun_address: d.address_name || null,
      phone:        d.phone || null,
      category:     mapCategory(d.category_name ?? ''),
      category_raw: d.category_name,
      latitude:     d.y ? parseFloat(d.y) : null,
      longitude:    d.x ? parseFloat(d.x) : null,
      place_url:    d.place_url || null,
    }));

    return NextResponse.json({
      places,
      meta: {
        total_count:    json.meta?.total_count    ?? 0,
        pageable_count: json.meta?.pageable_count ?? 0,
        is_end:         json.meta?.is_end         ?? true,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
