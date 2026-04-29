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

// ── v2 카테고리 매핑 (카카오 3뎁스 우선 매핑) ────────────────────
const CATEGORY_RULES: Array<{ result: string; keywords: string[] }> = [
  { result: '카페·디저트',   keywords: ['카페', '커피', '디저트', '아이스크림', '빙수', '버블티', '스무디'] },
  { result: '베이커리·빵집', keywords: ['베이커리', '빵', '제과', '케이크', '도넛', '크루아상'] },
  { result: '고기·구이',     keywords: ['삼겹살', '갈비', '곱창', '막창', '대창', '불고기', '오리구이', '닭갈비', '족발', '보쌈', '바비큐'] },
  { result: '해산물·회',     keywords: ['회', '해물', '해산물', '낙지', '조개', '굴', '새우', '대게', '꽃게', '아구', '복어', '장어'] },
  { result: '국밥·탕·찌개', keywords: ['국밥', '해장국', '설렁탕', '순대국', '감자탕', '순두부', '된장찌개', '부대찌개', '곰탕', '삼계탕'] },
  { result: '면류·냉면',     keywords: ['냉면', '막국수', '칼국수', '수제비', '쌀국수', '라멘', '우동', '소바', '라면', '짬뽕', '짜장'] },
  { result: '일식·초밥',     keywords: ['일식', '초밥', '롤', '돈카츠', '돈까스', '텐동', '오마카세', '야키토리'] },
  { result: '중식',          keywords: ['중식', '중국', '딤섬', '마라', '탕수육', '양꼬치', '훠궈'] },
  { result: '양식·파스타',   keywords: ['양식', '파스타', '스테이크', '이탈리안', '프렌치', '그릴', '피자'] },
  { result: '치킨·버거',     keywords: ['치킨', '버거', '햄버거', '패스트푸드', '핫도그'] },
  { result: '분식·떡볶이',   keywords: ['분식', '떡볶이', '순대', '김밥', '만두', '튀김', '포장마차', '닭강정', '샤브샤브'] },
  { result: '술집·이자카야', keywords: ['술집', '호프', '포차', '이자카야', '맥주', '와인바', '펍', '주점'] },
  { result: '브런치·샐러드', keywords: ['브런치', '샐러드', '도시락', '비건'] },
  { result: '한식',          keywords: ['한식', '비빔밥', '쌈밥', '백반', '정식', '기사식당', '철판'] },
];

function mapCategory(kakaoCategory: string): string {
  const parts = kakaoCategory.split('>').map(s => s.trim()).filter(Boolean);
  for (const part of [...parts].reverse()) {
    for (const { result, keywords } of CATEGORY_RULES) {
      if (keywords.some(kw => part.includes(kw))) return result;
    }
  }
  if (kakaoCategory.includes('카페')) return '카페·디저트';
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
  onPlace?: (name: string, category: string, address: string, isNew: boolean) => void,
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
        const isNew = !seen.has(doc.id);
        if (isNew) { seen.add(doc.id); results.push(doc); pageNew++; }
        onPlace?.(doc.place_name, mapCategory(doc.category_name), addr, isNew);
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
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); }
        catch { closed = true; }
      };

      send({ type: 'start', keywords, total: keywords.length });

      const allPlaces = new Map<string, KakaoPlace>();
      let totalSaved = 0;

      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        send({ type: 'keyword', keyword: kw, index: i, total: keywords.length });

        const places = await collectKeyword(
          kw, maxPages,
          (page, pageNew, cumTotal, isEnd) => {
            send({ type: 'page', keyword: kw, page, pageNew, cumTotal, isEnd });
          },
          (name, category, address, isNew) => {
            send({ type: 'place', keyword: kw, name, category, address, isNew });
          },
        );
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
      closed = true;
      try { controller.close(); } catch {}
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
