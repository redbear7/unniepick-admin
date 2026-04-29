/**
 * POST /api/collect/naver
 * body: { keywords?: string[], limit?: number }
 *
 * 네이버 로컬 검색 공식 API로 업체 수집
 * https://developers.naver.com/docs/serviceapi/search/local/local.md
 *
 * - display: 최대 5 (API 제한)
 * - start: 1~1000
 * - mapx/mapy: WGS84 × 10,000
 * - link URL에서 naver_place_id 추출
 * - keywords 미지정 시 crawl_keywords 테이블에서 is_daily=true 항목 사용
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const NAVER_API_BASE = 'https://openapi.naver.com/v1/search/local.json';

interface NaverPlace {
  title: string;           // 업체명 (HTML 태그 포함)
  link: string;            // 네이버 지도 URL
  category: string;        // 카테고리
  description: string;     // 설명
  telephone: string;       // 전화번호
  address: string;         // 지번주소
  roadAddress: string;     // 도로명주소
  mapx: string;            // 경도 × 10,000
  mapy: string;            // 위도 × 10,000
}

interface NaverResponse {
  items: NaverPlace[];
  total: number;
  display: number;
  start: number;
}

// ── HTML 태그 제거 ────────────────────────────────────────────────
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

// ── 네이버 place_id 추출 ──────────────────────────────────────────
// link 예: https://map.naver.com/p/entry/place/1234567890
function extractNaverPlaceId(link: string): string | null {
  const m = link.match(/\/place\/(\d+)/);
  return m ? m[1] : null;
}

// ── v2 언니픽 카테고리 매핑 ──────────────────────────────────────
function mapNaverCategory(category: string): string {
  const c = category;
  if (c.includes('카페') || c.includes('커피') || c.includes('디저트'))           return '카페·디저트';
  if (c.includes('베이커리') || c.includes('빵') || c.includes('제과'))           return '베이커리·빵집';
  if (c.includes('삼겹') || c.includes('갈비') || c.includes('곱창') || c.includes('불고기') || c.includes('족발') || c.includes('보쌈')) return '고기·구이';
  if (c.includes('회') || c.includes('해산물') || c.includes('해물') || c.includes('낙지') || c.includes('조개')) return '해산물·회';
  if (c.includes('국밥') || c.includes('해장국') || c.includes('설렁탕') || c.includes('순두부') || c.includes('찌개')) return '국밥·탕·찌개';
  if (c.includes('냉면') || c.includes('칼국수') || c.includes('라멘') || c.includes('우동') || c.includes('쌀국수')) return '면류·냉면';
  if (c.includes('일식') || c.includes('초밥') || c.includes('돈카츠') || c.includes('오마카세'))                return '일식·초밥';
  if (c.includes('중식') || c.includes('짜장') || c.includes('짬뽕') || c.includes('마라'))                     return '중식';
  if (c.includes('양식') || c.includes('파스타') || c.includes('스테이크') || c.includes('이탈리안'))            return '양식·파스타';
  if (c.includes('치킨') || c.includes('버거') || c.includes('피자'))             return '치킨·버거';
  if (c.includes('분식') || c.includes('떡볶이') || c.includes('김밥'))           return '분식·떡볶이';
  if (c.includes('술집') || c.includes('이자카야') || c.includes('호프') || c.includes('포차')) return '술집·이자카야';
  if (c.includes('브런치') || c.includes('샐러드'))                               return '브런치·샐러드';
  if (c.includes('한식'))                                                          return '한식';
  return '기타';
}

// ── 단일 키워드 검색 (최대 5페이지 × 5건 = 25건) ─────────────────
async function searchKeyword(
  keyword: string,
  clientId: string,
  clientSecret: string,
  maxPages = 5,
): Promise<NaverPlace[]> {
  const results: NaverPlace[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const start = (page - 1) * 5 + 1;
    const url = `${NAVER_API_BASE}?query=${encodeURIComponent(keyword)}&display=5&start=${start}&sort=random`;

    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id':     clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!res.ok) {
      console.error(`[collect/naver] ${keyword} p${page}: ${res.status}`);
      break;
    }

    const data: NaverResponse = await res.json();
    if (!data.items?.length) break;

    for (const item of data.items) {
      const key = item.link || `${item.title}-${item.address}`;
      if (!seen.has(key)) { seen.add(key); results.push(item); }
    }

    if (data.items.length < 5) break; // 마지막 페이지
    await new Promise(r => setTimeout(r, 200)); // rate-limit 방지
  }

  return results;
}

// ── Supabase upsert ───────────────────────────────────────────────
async function upsertNaverPlaces(
  sb: ReturnType<typeof adminSb>,
  places: NaverPlace[],
  keyword: string,
): Promise<{ saved: number; skipped: number }> {
  const rows: Record<string, unknown>[] = [];

  for (const p of places) {
    const name     = stripHtml(p.title);
    const placeId  = extractNaverPlaceId(p.link);
    const address  = p.roadAddress || p.address || '';
    const lat      = p.mapy ? parseFloat(p.mapy) / 10_000 : null;
    const lng      = p.mapx ? parseFloat(p.mapx) / 10_000 : null;
    const category = p.category || '기타';

    if (!name || !address) continue;

    rows.push({
      name,
      address,
      phone:              p.telephone || null,
      category,
      unniepick_category: mapNaverCategory(category),
      latitude:           lat,
      longitude:          lng,
      naver_place_url:    placeId ? `https://map.naver.com/p/entry/place/${placeId}` : (p.link || null),
      naver_place_id:     placeId,
      source:             'naver',
      tags:               [keyword, '네이버API'],
      crawled_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    });
  }

  if (!rows.length) return { saved: 0, skipped: places.length };

  // naver_place_id 있는 것 / 없는 것 분리
  const withId    = rows.filter(r => r.naver_place_id);
  const withoutId = rows.filter(r => !r.naver_place_id);
  let saved = 0;

  if (withId.length) {
    const { data, error } = await sb
      .from('restaurants')
      .upsert(withId, { onConflict: 'naver_place_id', ignoreDuplicates: false })
      .select('id');
    if (!error) saved += data?.length ?? 0;
    else console.error('[collect/naver] upsert:', error.message);
  }

  if (withoutId.length) {
    // ID 없는 업체는 name+address 기준으로 중복 체크 후 insert
    const { data, error } = await sb
      .from('restaurants')
      .insert(withoutId)
      .select('id');
    if (!error) saved += data?.length ?? 0;
  }

  return { saved, skipped: places.length - rows.length };
}

// ── 라우트 핸들러 ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const CLIENT_ID     = process.env.NAVER_CLIENT_ID;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({})) as {
    keywords?: string[];
    limit?: number;
  };

  const sb = adminSb();

  // 키워드 목록 결정
  let keywords: string[] = body.keywords ?? [];
  if (!keywords.length) {
    const { data } = await sb
      .from('crawl_keywords')
      .select('keyword')
      .eq('is_daily', true)
      .limit(body.limit ?? 20);
    keywords = (data ?? []).map((r: any) => r.keyword);
  }

  if (!keywords.length) {
    return NextResponse.json({ ok: true, total: 0, saved: 0, message: '키워드 없음' });
  }

  let totalCollected = 0;
  let totalSaved     = 0;
  const results: Array<{ keyword: string; collected: number; saved: number }> = [];

  for (const keyword of keywords) {
    try {
      const places = await searchKeyword(keyword, CLIENT_ID, CLIENT_SECRET, 5);
      const { saved } = await upsertNaverPlaces(sb, places, keyword);
      totalCollected += places.length;
      totalSaved     += saved;
      results.push({ keyword, collected: places.length, saved });
    } catch (e) {
      console.error(`[collect/naver] "${keyword}":`, e);
      results.push({ keyword, collected: 0, saved: 0 });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return NextResponse.json({
    ok: true,
    total:   totalCollected,
    saved:   totalSaved,
    results,
  });
}
