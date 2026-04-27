/**
 * GET /api/naver-place?q=검색어&size=5
 *
 * 네이버 지역 검색 API
 * 결과: place_name, address, road_address, phone, category, place_url
 *
 * 필요 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 */
import { NextRequest, NextResponse } from 'next/server';

function stripHtml(str: string) {
  return str.replace(/<[^>]*>/g, '');
}

export async function GET(req: NextRequest) {
  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'NAVER_CLIENT_ID/SECRET 환경변수가 없습니다' }, { status: 500 });
  }

  const q    = req.nextUrl.searchParams.get('q')?.trim();
  const size = req.nextUrl.searchParams.get('size') ?? '5';

  if (!q) return NextResponse.json({ error: '검색어(q)가 필요합니다' }, { status: 400 });

  const params = new URLSearchParams({ query: q, display: size, sort: 'comment' });

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?${params}`,
      {
        headers: {
          'X-Naver-Client-Id':     clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[naver-place] API error', res.status, err);
      return NextResponse.json({ error: `네이버 API 오류 (${res.status})` }, { status: 502 });
    }

    const json = await res.json();
    const places = (json.items ?? []).map((item: any, idx: number) => ({
      naver_id:     String(idx),
      place_name:   stripHtml(item.title ?? ''),
      address:      item.roadAddress || item.address || '',
      road_address: item.roadAddress || null,
      phone:        item.telephone || null,
      category:     item.category || '',
      category_raw: item.category || '',
      place_url:    item.link || null,
    }));

    return NextResponse.json({ places });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
