import { NextRequest, NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Accept': 'text/html,application/xhtml+xml',
};

/** naver.me 단축 URL → 실제 URL (수동 리다이렉트) */
async function resolveShortUrl(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(current, { method: 'GET', redirect: 'manual', headers: HEADERS });
    const loc = res.headers.get('location');
    if (!loc) return current;
    current = loc.startsWith('http') ? loc : new URL(loc, current).href;
  }
  return current;
}

/** URL에서 장소 ID 추출 */
function extractPlaceId(url: string): string | null {
  const m = url.match(/\/(?:place|entry\/place)\/(\d{5,})/);
  return m ? m[1] : null;
}

/** URL 쿼리에서 좌표 추출 */
function extractCoordsFromUrl(url: string) {
  try {
    const u = new URL(url);
    const lat = u.searchParams.get('lat') ?? u.searchParams.get('latitude');
    const lng = u.searchParams.get('lng') ?? u.searchParams.get('longitude');
    if (lat && lng) return { lat: parseFloat(lat), lng: parseFloat(lng) };
  } catch {}
  return null;
}

/** HTML에서 첫 번째 og 메타 값 추출 */
function ogMeta(html: string, prop: string): string {
  const m = html.match(new RegExp(
    `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'
  )) ?? html.match(new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'
  ));
  return m ? m[1].replace(/&amp;/g, '&').trim() : '';
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'url 파라미터가 필요합니다' }, { status: 400 });

  let url = raw.trim();

  // 단축 URL 해제
  if (url.includes('naver.me')) {
    try { url = await resolveShortUrl(url); }
    catch { return NextResponse.json({ error: '단축 URL 해석에 실패했습니다' }, { status: 400 }); }
  }

  // URL 쿼리에서 좌표 미리 추출
  const urlCoords = extractCoordsFromUrl(url);

  const placeId = extractPlaceId(url);
  if (!placeId) {
    return NextResponse.json({ error: `유효한 네이버 업체 URL이 아닙니다\n해석 결과: ${url}` }, { status: 400 });
  }

  // pcmap 페이지 fetch — /place/{id} 로 요청하면 올바른 타입으로 자동 리다이렉트됨
  let html: string;
  try {
    const res = await fetch(`https://pcmap.place.naver.com/place/${placeId}/home`, {
      headers: HEADERS,
      redirect: 'follow',
      next: { revalidate: 0 },
    });
    if (!res.ok) return NextResponse.json({ error: `페이지를 가져오지 못했습니다 (${res.status})` }, { status: 502 });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: '네이버 페이지 접근 중 오류가 발생했습니다' }, { status: 500 });
  }

  /* ---- 가게명: og:title에서 " : 네이버" 제거 ---- */
  const rawTitle = ogMeta(html, 'og:title');
  const name = rawTitle.replace(/\s*:\s*네이버.*$/, '').trim();

  /* ---- 주소: data-kakaotalk-description 속성 ---- */
  const addrMatch = html.match(/data-kakaotalk-description="([^"]+)"/);
  const address = addrMatch ? addrMatch[1].replace(/&amp;/g, '&').trim() : '';

  /* ---- 전화번호: 0XX-XXXX-XXXX 패턴 (첫 번째) ---- */
  const phoneMatches = html.match(/0\d{1,2}-\d{3,4}-\d{4}/g) ?? [];
  const phone = phoneMatches[0] ?? '';

  /* ---- 카테고리: "category":"..." JSON 패턴 ---- */
  const catMatch = html.match(/"category"\s*:\s*"([^"]{2,30})"/);
  const category = catMatch ? catMatch[1] : '';

  /* ---- 이미지: og:image ---- */
  const rawImage = ogMeta(html, 'og:image');
  // pstatic.net common URL에서 실제 src 추출
  const imgSrcMatch = rawImage.match(/[?&]src=([^&]+)/);
  const image_url = imgSrcMatch
    ? decodeURIComponent(imgSrcMatch[1])
    : rawImage;

  /* ---- 좌표: URL 쿼리 우선 ---- */
  const latitude  = urlCoords?.lat ?? null;
  const longitude = urlCoords?.lng ?? null;

  if (!name) {
    return NextResponse.json({ error: '업체 정보를 찾을 수 없습니다. 네이버 지도 URL을 확인해 주세요.' }, { status: 404 });
  }

  return NextResponse.json({
    name,
    address,
    phone,
    category,
    latitude,
    longitude,
    image_url,
    naver_place_id: placeId,
  });
}
