/**
 * POST /api/collect/kakao
 * body: { gu?: string, radiusM?: number, dryRun?: boolean }
 *
 * 창원시 헥사고날 격자 기반 카카오 공식 API 수집 (FD6+CE7)
 * SSE(text/event-stream)로 실시간 진행률 전송
 *
 * 헥스 그리드: 행간격 = 3r/2, 열간격 = r√3 → 완전 커버리지 보장
 */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ── 카테고리 매핑 ─────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  '한식': '한식', '중식': '중식', '일식': '일식', '양식': '양식', '분식': '분식',
  '치킨': '치킨', '피자': '피자', '패스트푸드': '패스트푸드',
  '술집': '술집/바', '이자카야': '술집/바', '포장마차': '술집/바', '호프': '술집/바',
  '뷔페': '뷔페', '브런치': '브런치', '베이커리': '베이커리', '샌드위치': '브런치',
  '카페': '카페', '커피': '카페', '디저트': '카페', '아이스크림': '카페',
  '인도음식': '아시안', '태국음식': '아시안', '베트남음식': '아시안', '아시아음식': '아시안',
  '멕시코음식': '양식', '스테이크': '양식',
  '해산물': '해산물', '회': '해산물', '초밥': '일식', '라멘': '일식', '돈까스': '일식',
  '곱창': '한식', '삼겹살': '한식', '고기': '한식', '국밥': '한식',
  '냉면': '한식', '보쌈': '한식', '족발': '한식', '기사식당': '한식',
  '떡': '간식', '간식': '간식', '토스트': '간식', '도넛': '간식', '닭강정': '간식',
  '도시락': '도시락', '샐러드': '샐러드',
};

function mapCategory(kakaoCategory: string): string {
  const parts = kakaoCategory.split('>').map(s => s.trim());
  for (const part of parts.slice(1)) {
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (part.includes(key)) return val;
    }
  }
  if (kakaoCategory.includes('카페')) return '카페';
  return '기타';
}

// ── 격자점 타입 ───────────────────────────────────────────────────
interface GridPoint { name: string; lat: number; lng: number; radius: number; }
interface Region {
  district: string; name: string;
  minLat: number; maxLat: number;
  minLng: number; maxLng: number;
  radiusM?: number;
}

/** 완전 커버리지 헥사고날 그리드 (D = r√3 최대 간격) */
function generateHexGrid(region: Region, defaultRadius: number): GridPoint[] {
  const r = region.radiusM ?? defaultRadius;
  const LAT_PER_M = 1 / 111_000;
  const midLat    = (region.minLat + region.maxLat) / 2;
  const LNG_PER_M = 1 / (111_000 * Math.cos((midLat * Math.PI) / 180));

  const rowStepDeg = r * 1.5         * LAT_PER_M;  // 3r/2
  const colStepDeg = r * Math.sqrt(3) * LNG_PER_M; // r√3

  const points: GridPoint[] = [];
  let row = 0;

  for (let lat = region.minLat; lat <= region.maxLat + rowStepDeg * 0.5; lat += rowStepDeg) {
    const lngOffset = row % 2 === 1 ? colStepDeg / 2 : 0;
    let col = 0;
    for (let lng = region.minLng + lngOffset; lng <= region.maxLng + colStepDeg * 0.5; lng += colStepDeg) {
      points.push({ name: `${region.name}-${row + 1}-${col + 1}`, lat: +lat.toFixed(5), lng: +lng.toFixed(5), radius: r });
      col++;
    }
    row++;
  }
  return points;
}

// ── 창원시 지역 정의 ──────────────────────────────────────────────
const REGIONS: Region[] = [
  { district: '성산구',    name: '성산구',      minLat: 35.196, maxLat: 35.258, minLng: 128.655, maxLng: 128.730 },
  { district: '의창구',    name: '의창구-도심',  minLat: 35.236, maxLat: 35.282, minLng: 128.588, maxLng: 128.695 },
  { district: '의창구',    name: '의창구-북면',  minLat: 35.288, maxLat: 35.396, minLng: 128.575, maxLng: 128.660, radiusM: 2500 },
  { district: '마산합포구', name: '마산합포-도심', minLat: 35.162, maxLat: 35.222, minLng: 128.482, maxLng: 128.612 },
  { district: '마산합포구', name: '마산합포-구산', minLat: 35.080, maxLat: 35.163, minLng: 128.448, maxLng: 128.558, radiusM: 2500 },
  { district: '마산회원구', name: '마산회원',     minLat: 35.185, maxLat: 35.285, minLng: 128.510, maxLng: 128.628 },
  { district: '진해구',    name: '진해-도심',    minLat: 35.125, maxLat: 35.208, minLng: 128.642, maxLng: 128.762 },
  { district: '진해구',    name: '진해-웅동',    minLat: 35.158, maxLat: 35.232, minLng: 128.757, maxLng: 128.848, radiusM: 2500 },
];

// ── 카카오 API ────────────────────────────────────────────────────
interface KakaoPlace {
  id: string; place_name: string; category_name: string;
  phone: string; address_name: string; road_address_name: string;
  x: string; y: string; place_url: string;
}

async function fetchKakaoCategory(
  code: string, lat: number, lng: number, radius: number, page: number,
  apiKey: string,
): Promise<{ documents: KakaoPlace[]; meta: { is_end: boolean } }> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
  url.searchParams.set('category_group_code', code);
  url.searchParams.set('y', String(lat));
  url.searchParams.set('x', String(lng));
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', '15');
  url.searchParams.set('sort', 'distance');

  const res = await fetch(url.toString(), { headers: { Authorization: `KakaoAK ${apiKey}` } });
  if (!res.ok) throw new Error(`카카오 API ${res.status}`);
  return res.json();
}

async function collectPoint(point: GridPoint, code: string, apiKey: string): Promise<KakaoPlace[]> {
  const results: KakaoPlace[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 3; page++) {
    await new Promise(r => setTimeout(r, 250));
    try {
      const data = await fetchKakaoCategory(code, point.lat, point.lng, point.radius, page, apiKey);
      for (const doc of data.documents) {
        if (!seen.has(doc.id)) { seen.add(doc.id); results.push(doc); }
      }
      if (data.meta.is_end) break;
    } catch { break; }
  }
  return results;
}

async function upsertPlaces(sb: ReturnType<typeof adminSb>, places: KakaoPlace[]): Promise<number> {
  if (!places.length) return 0;
  const rows = places.map(p => ({
    kakao_place_id:     p.id,
    kakao_place_url:    p.place_url,
    kakao_category:     p.category_name,
    unniepick_category: mapCategory(p.category_name),
    name:               p.place_name,
    phone:              p.phone || null,
    address:            p.road_address_name || p.address_name || null,
    latitude:           parseFloat(p.y) || null,
    longitude:          parseFloat(p.x) || null,
    source:             'kakao',
    operating_status:   'unknown',
    crawled_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
  }));
  const { data, error } = await sb
    .from('restaurants')
    .upsert(rows, { onConflict: 'kakao_place_id', ignoreDuplicates: false })
    .select('id');
  if (error) { console.error('[collect/kakao] upsert:', error.message); return 0; }
  return data?.length ?? 0;
}

// ── 라우트 핸들러 ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    gu?: string;
    radiusM?: number;
    dryRun?: boolean;
  };

  const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
  if (!KAKAO_KEY) {
    return new Response('{"error":"KAKAO_REST_API_KEY 없음"}', { status: 500 });
  }

  const defaultRadius = body.radiusM ?? 1500;
  const regions = body.gu ? REGIONS.filter(r => r.district === body.gu) : REGIONS;
  const points  = regions.flatMap(r => generateHexGrid(r, defaultRadius));

  const sb = adminSb();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const allPlaces = new Map<string, KakaoPlace>();
      let pointsDone = 0;

      send({ type: 'start', total: points.length, regions: regions.map(r => r.name) });

      for (const point of points) {
        try {
          for (const code of ['FD6', 'CE7']) {
            const places = await collectPoint(point, code, KAKAO_KEY);
            for (const p of places) allPlaces.set(p.id, p);
            await new Promise(r => setTimeout(r, 100));
          }
        } catch (e) {
          send({ type: 'warn', point: point.name, msg: (e as Error).message });
        }
        pointsDone++;
        send({ type: 'progress', point: point.name, done: pointsDone, total: points.length, collected: allPlaces.size });
      }

      // 카테고리별 집계
      const catCount: Record<string, number> = {};
      for (const p of allPlaces.values()) {
        const c = mapCategory(p.category_name);
        catCount[c] = (catCount[c] ?? 0) + 1;
      }

      let saved = 0;
      if (!body.dryRun) {
        const arr = [...allPlaces.values()];
        for (let i = 0; i < arr.length; i += 100) {
          saved += await upsertPlaces(sb, arr.slice(i, i + 100));
        }
      }

      send({ type: 'done', total: allPlaces.size, saved, categories: catCount });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
