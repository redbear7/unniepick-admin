/**
 * 카카오 로컬 공식 API 수집 스크립트
 * 창원시 5개 구를 격자 분할하여 FD6(음식점) + CE7(카페) 전체 수집
 *
 * 실행: npx tsx src/kakao-api-collect.ts
 * 옵션: --gu=성산구  (특정 구만 수집)
 *       --dry-run   (DB 저장 없이 개수만 확인)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY!;
const DRY_RUN   = process.argv.includes('--dry-run');
const GU_FILTER = process.argv.find(a => a.startsWith('--gu='))?.split('=')[1];

// ── 카테고리 수집 대상 ────────────────────────────────────────────
const CATEGORIES = [
  { code: 'FD6', name: '음식점' },
  { code: 'CE7', name: '카페' },
];

// ── 언니픽 카테고리 매핑 (카카오 2depth 기준) ─────────────────────
const CATEGORY_MAP: Record<string, string> = {
  '한식':       '한식',
  '중식':       '중식',
  '일식':       '일식',
  '양식':       '양식',
  '분식':       '분식',
  '치킨':       '치킨',
  '피자':       '피자',
  '패스트푸드': '패스트푸드',
  '술집':       '술집/바',
  '이자카야':   '술집/바',
  '포장마차':   '술집/바',
  '호프':       '술집/바',
  '뷔페':       '뷔페',
  '브런치':     '브런치',
  '베이커리':   '베이커리',
  '샌드위치':   '브런치',
  '카페':       '카페',
  '커피':       '카페',
  '디저트':     '카페',
  '아이스크림': '카페',
  '인도음식':   '아시안',
  '태국음식':   '아시안',
  '베트남음식': '아시안',
  '아시아음식': '아시안',
  '멕시코음식': '양식',
  '스테이크':   '양식',
  '해산물':     '해산물',
  '회':         '해산물',
  '초밥':       '일식',
  '라멘':       '일식',
  '돈까스':     '일식',
  '곱창':       '한식',
  '삼겹살':     '한식',
  '고기':       '한식',
  '국밥':       '한식',
  '냉면':       '한식',
  '보쌈':       '한식',
  '족발':       '한식',
};

function mapCategory(kakaoCategory: string): string {
  // "음식점 > 한식 > 국밥" → depth2 추출
  const parts = kakaoCategory.split('>').map(s => s.trim());
  for (const part of parts.slice(1)) {
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (part.includes(key)) return val;
    }
  }
  // CE7 그룹이면 카페로
  if (kakaoCategory.includes('카페')) return '카페';
  return '기타';
}

// ── 창원시 격자 좌표 (구별 복수 중심점) ──────────────────────────
interface GridPoint { name: string; lat: number; lng: number; radius: number; }

const CHANGWON_GRID: GridPoint[] = [
  // 성산구 (상남동, 용호동, 반림동, 중앙동)
  { name: '성산구-상남동',   lat: 35.2280, lng: 128.6814, radius: 2000 },
  { name: '성산구-용호동',   lat: 35.2195, lng: 128.7050, radius: 2000 },
  { name: '성산구-반림동',   lat: 35.2350, lng: 128.6900, radius: 2000 },
  { name: '성산구-중앙동',   lat: 35.2260, lng: 128.6750, radius: 2000 },
  { name: '성산구-대방동',   lat: 35.2100, lng: 128.6930, radius: 2000 },

  // 의창구 (용지동, 팔용동, 북면, 대원동)
  { name: '의창구-용지동',   lat: 35.2520, lng: 128.6620, radius: 2000 },
  { name: '의창구-팔용동',   lat: 35.2430, lng: 128.6540, radius: 2000 },
  { name: '의창구-봉림동',   lat: 35.2650, lng: 128.6480, radius: 2000 },
  { name: '의창구-북면',     lat: 35.3150, lng: 128.6150, radius: 3000 },

  // 마산합포구 (오동동, 창동, 어시장, 구산면)
  { name: '마산합포-오동동', lat: 35.1960, lng: 128.5790, radius: 2000 },
  { name: '마산합포-창동',   lat: 35.2010, lng: 128.5720, radius: 1500 },
  { name: '마산합포-월영동', lat: 35.1850, lng: 128.5650, radius: 2000 },
  { name: '마산합포-구산면', lat: 35.1300, lng: 128.5200, radius: 3000 },

  // 마산회원구 (석전동, 내서읍, 회원동)
  { name: '마산회원-석전동', lat: 35.2190, lng: 128.5820, radius: 2000 },
  { name: '마산회원-내서읍', lat: 35.2500, lng: 128.5350, radius: 3000 },
  { name: '마산회원-회원동', lat: 35.2100, lng: 128.5680, radius: 1500 },

  // 진해구 (경화동, 석동, 웅동)
  { name: '진해구-경화동',   lat: 35.1530, lng: 128.6920, radius: 2000 },
  { name: '진해구-석동',     lat: 35.1670, lng: 128.7100, radius: 2000 },
  { name: '진해구-웅동',     lat: 35.1800, lng: 128.7600, radius: 3000 },
];

// ── 카카오 API 타입 ───────────────────────────────────────────────
interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도
  y: string; // 위도
  place_url: string;
}

interface KakaoResponse {
  documents: KakaoPlace[];
  meta: { total_count: number; pageable_count: number; is_end: boolean; };
}

// ── API 요청 (딜레이 포함) ────────────────────────────────────────
async function fetchKakaoCategory(
  categoryCode: string,
  lat: number,
  lng: number,
  radius: number,
  page: number,
): Promise<KakaoResponse> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
  url.searchParams.set('category_group_code', categoryCode);
  url.searchParams.set('y', String(lat));
  url.searchParams.set('x', String(lng));
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', '15');
  url.searchParams.set('sort', 'distance');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`카카오 API 오류 ${res.status}: ${text}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 단일 격자점 × 카테고리 전체 수집 (최대 3페이지 × 15건 = 45건) ─
async function collectFromPoint(
  point: GridPoint,
  categoryCode: string,
): Promise<KakaoPlace[]> {
  const results: KakaoPlace[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= 3; page++) {
    await sleep(300); // API 호출 간격
    try {
      const data = await fetchKakaoCategory(categoryCode, point.lat, point.lng, point.radius, page);
      for (const doc of data.documents) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          results.push(doc);
        }
      }
      if (data.meta.is_end) break;
    } catch (e) {
      console.error(`  ⚠️  ${point.name} page${page} 오류:`, (e as Error).message);
      break;
    }
  }
  return results;
}

// ── Supabase upsert ───────────────────────────────────────────────
async function upsertKakaoPlaces(places: KakaoPlace[]): Promise<number> {
  if (!places.length) return 0;

  const rows = places.map(p => ({
    kakao_place_id:     p.id,
    kakao_place_url:    p.place_url,
    kakao_category:     p.category_name,
    unniepick_category: mapCategory(p.category_name),
    name:               p.place_name,
    phone:              p.phone || null,
    address:            p.road_address_name || p.address_name || null,
    latitude:           parseFloat(p.y),
    longitude:          parseFloat(p.x),
    source:             'kakao',
    operating_status:   'unknown',
    crawled_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('restaurants')
    .upsert(rows, { onConflict: 'kakao_place_id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    console.error('  ❌ upsert 오류:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

// ── 메인 ──────────────────────────────────────────────────────────
async function main() {
  if (!KAKAO_KEY) {
    console.error('❌ KAKAO_REST_API_KEY가 .env에 없습니다.');
    process.exit(1);
  }

  const points = GU_FILTER
    ? CHANGWON_GRID.filter(p => p.name.startsWith(GU_FILTER))
    : CHANGWON_GRID;

  console.log(`\n🗺️  카카오 API 수집 시작`);
  console.log(`   격자점: ${points.length}개 | 카테고리: ${CATEGORIES.length}개`);
  console.log(`   예상 요청 수: 최대 ${points.length * CATEGORIES.length * 3}회`);
  if (DRY_RUN) console.log('   [DRY-RUN] DB 저장 안 함\n');

  const allPlaces = new Map<string, KakaoPlace>(); // 중복 제거용

  for (const point of points) {
    for (const cat of CATEGORIES) {
      process.stdout.write(`  📍 ${point.name} / ${cat.name} ... `);
      const places = await collectFromPoint(point, cat.code);
      for (const p of places) allPlaces.set(p.id, p);
      process.stdout.write(`${places.length}건\n`);
      await sleep(200);
    }
  }

  // 카테고리별 집계 출력
  const categoryCount: Record<string, number> = {};
  for (const p of allPlaces.values()) {
    const cat = mapCategory(p.category_name);
    categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
  }

  console.log(`\n📊 수집 결과 (중복 제거 후)`);
  console.log(`   총 업체 수: ${allPlaces.size}개`);
  console.log(`\n   카테고리별:`);
  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, cnt]) => console.log(`   ${cat.padEnd(12)}: ${cnt}개`));

  if (DRY_RUN) {
    console.log('\n✅ DRY-RUN 완료 (저장 없음)');
    return;
  }

  // 배치 upsert (100개씩)
  const allArr = [...allPlaces.values()];
  let saved = 0;
  for (let i = 0; i < allArr.length; i += 100) {
    const batch = allArr.slice(i, i + 100);
    saved += await upsertKakaoPlaces(batch);
    process.stdout.write(`\r   저장 중... ${Math.min(i + 100, allArr.length)}/${allArr.length}`);
  }

  console.log(`\n\n✅ 완료! ${saved}개 저장됨`);
}

main().catch(console.error);
