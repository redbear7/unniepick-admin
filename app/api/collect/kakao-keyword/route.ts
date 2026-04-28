/**
 * POST /api/collect/kakao-keyword
 * body: { keywords: string[], limit?: number }
 *
 * 카카오 키워드 검색 API로 인기·검증 업체 수집
 * → "창원 팔용동 맛집", "창원 한식 맛집" 등 키워드별 관련도순 결과
 * SSE(text/event-stream)로 실시간 진행률 전송
 */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY!;

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
  '냉면': '한식', '보쌈': '한식', '족발': '한식',
  '떡': '간식', '간식': '간식', '토스트': '간식', '도넛': '간식', '닭강정': '간식',
  '도시락': '도시락', '샐러드': '샐러드', '샤브샤브': '한식', '철판': '한식',
};

function mapCategory(kakaoCategory: string): string {
  const parts = kakaoCategory.split('>').map(s => s.trim());
  for (const part of parts.slice(1)) {
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (part.includes(key)) return val;
    }
  }
  if (kakaoCategory.includes('카페')) return '카페';
  if (kakaoCategory.trim() === '음식점') return '한식';
  return '기타';
}

interface KakaoPlace {
  id: string; place_name: string; category_name: string;
  phone: string; address_name: string; road_address_name: string;
  x: string; y: string; place_url: string;
}

async function searchKeyword(query: string, page: number): Promise<{ documents: KakaoPlace[]; meta: { is_end: boolean; total_count: number } }> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', '15');
  url.searchParams.set('sort', 'accuracy'); // 관련도순 (인기·검증 업체 우선)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  if (!res.ok) throw new Error(`카카오 API ${res.status}`);
  return res.json();
}

async function collectKeyword(
  keyword: string,
  maxPages = 5,
  onPage?: (page: number, found: number, total: number, isEnd: boolean) => void,
): Promise<KakaoPlace[]> {
  const results: KakaoPlace[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= maxPages; page++) {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    try {
      const data = await searchKeyword(keyword, page);
      let pageNew = 0;
      for (const doc of data.documents) {
        const addr = doc.address_name || doc.road_address_name || '';
        if (!addr.includes('창원')) continue;
        if (!seen.has(doc.id)) { seen.add(doc.id); results.push(doc); pageNew++; }
      }
      onPage?.(page, pageNew, results.length, data.meta.is_end);
      if (data.meta.is_end) break;
    } catch (e) {
      onPage?.(page, 0, results.length, true);
      break;
    }
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
    address:            p.address_name      || null,
    road_address:       p.road_address_name || null,
    latitude:           parseFloat(p.y) || null,
    longitude:          parseFloat(p.x) || null,
    source:             'kakao',
    operating_status:   'unknown',
    crawled_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
  }));
  const { data, error } = await sb.from('restaurants')
    .upsert(rows, { onConflict: 'kakao_place_id', ignoreDuplicates: false })
    .select('id');
  if (error) { console.error('upsert:', error.message); return 0; }
  return data?.length ?? 0;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    keywords?: string[];
    maxPages?: number;
    dryRun?: boolean;
  };

  const keywords: string[] = body.keywords ?? [];
  const maxPages = Math.min(body.maxPages ?? 5, 10); // 키워드당 최대 10페이지(150개)
  const dryRun = body.dryRun ?? false;

  if (!keywords.length) {
    return new Response(JSON.stringify({ error: 'keywords 필요' }), { status: 400 });
  }
  if (!KAKAO_KEY) {
    return new Response(JSON.stringify({ error: 'KAKAO_REST_API_KEY 없음' }), { status: 500 });
  }

  const sb = adminSb();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: 'start', keywords, total: keywords.length });

      const allPlaces = new Map<string, KakaoPlace>();
      let totalSaved = 0;

      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        send({ type: 'keyword', keyword: kw, index: i, total: keywords.length });

        const places = await collectKeyword(kw, maxPages, (page, pageNew, cumTotal, isEnd) => {
          send({ type: 'page', keyword: kw, page, pageNew, cumTotal, isEnd });
        });
        for (const p of places) allPlaces.set(p.id, p);

        // 카테고리별 집계
        const kwCats: Record<string, number> = {};
        for (const p of places) {
          const c = mapCategory(p.category_name);
          kwCats[c] = (kwCats[c] ?? 0) + 1;
        }
        send({ type: 'keyword_done', keyword: kw, found: places.length, total_unique: allPlaces.size, cats: kwCats });

        // 키워드 간 인간적 딜레이 (2~5초)
        if (i < keywords.length - 1) {
          const delay = 2000 + Math.random() * 3000;
          send({ type: 'delay', ms: Math.round(delay) });
          await new Promise(r => setTimeout(r, delay));
        }
      }

      if (!dryRun) {
        const arr = [...allPlaces.values()];
        for (let i = 0; i < arr.length; i += 100) {
          const saved = await upsertPlaces(sb, arr.slice(i, i + 100));
          totalSaved += saved;
        }
      }

      // 카테고리별 집계
      const catCount: Record<string, number> = {};
      for (const p of allPlaces.values()) {
        const c = mapCategory(p.category_name);
        catCount[c] = (catCount[c] ?? 0) + 1;
      }

      send({ type: 'done', total: allPlaces.size, saved: totalSaved, categories: catCount, dryRun });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
