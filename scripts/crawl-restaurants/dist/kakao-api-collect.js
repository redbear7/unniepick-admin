/**
 * 카카오 로컬 공식 API 수집 스크립트
 * 창원시 5개 구를 헥사고날 격자로 자동 분할 → FD6(음식점) + CE7(카페) 전체 수집
 *
 * 실행: npx tsx src/kakao-api-collect.ts
 * 옵션: --gu=성산구        특정 구만 수집
 *       --radius=1500     격자 반경(m) 기본값: 1500
 *       --dry-run         DB 저장 없이 개수만 확인
 *
 * 헥스 그리드 원리:
 *   반경 r인 원들이 완전 커버리지(갭 없음)를 보장하려면
 *   인접 중심 간격 D ≤ r√3 이어야 한다.
 *   행 간격 h = D√3/2 = 3r/2, 열 간격 = r√3, 홀수 행 오프셋 = r√3/2
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createTimer } from './human-delay.js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const GU_FILTER = process.argv.find(a => a.startsWith('--gu='))?.split('=')[1];
const RADIUS_ARG = parseInt(process.argv.find(a => a.startsWith('--radius='))?.split('=')[1] ?? '1500');
// ── 카테고리 수집 대상 ────────────────────────────────────────────
const CATEGORIES = [
    { code: 'FD6', name: '음식점' },
    { code: 'CE7', name: '카페' },
];
// ── 언니픽 카테고리 매핑 (카카오 2depth 기준) ─────────────────────
const CATEGORY_MAP = {
    '한식': '한식', '중식': '중식', '일식': '일식', '양식': '양식', '분식': '분식',
    '치킨': '치킨', '피자': '피자', '패스트푸드': '패스트푸드',
    '술집': '술집/바', '이자카야': '술집/바', '포장마차': '술집/바', '호프': '술집/바',
    '뷔페': '뷔페', '브런치': '브런치', '베이커리': '베이커리', '샌드위치': '브런치',
    '카페': '카페', '커피': '카페', '디저트': '카페', '아이스크림': '카페',
    '인도음식': '아시안', '태국음식': '아시안', '베트남음식': '아시안', '아시아음식': '아시안',
    '멕시코음식': '양식', '스테이크': '양식',
    '해산물': '해산물', '회': '해산물', '초밥': '일식', '라멘': '일식', '돈까스': '일식',
    '곱창': '한식', '삼겹살': '한식', '고기': '한식', '국밥': '한식',
    '냉면': '한식', '보쌈': '한식', '족발': '한식', '기사식당': '한식', '구내식당': '한식',
    '떡': '간식', '한과': '간식', '간식': '간식', '토스트': '간식', '도넛': '간식', '닭강정': '간식',
    '도시락': '도시락', '샐러드': '샐러드',
};
function mapCategory(kakaoCategory) {
    const parts = kakaoCategory.split('>').map(s => s.trim());
    for (const part of parts.slice(1)) {
        for (const [key, val] of Object.entries(CATEGORY_MAP)) {
            if (part.includes(key))
                return val;
        }
    }
    if (kakaoCategory.includes('카페'))
        return '카페';
    if (kakaoCategory.trim() === '음식점')
        return '한식';
    return '기타';
}
/**
 * 완전 커버리지 헥사고날 그리드 생성
 * - 행 간격 h = 3r/2, 열 간격 d = r√3
 * - 홀수 행 오프셋 = d/2
 * - 모든 점이 반경 r 이내에 최소 1개의 격자점을 보유
 */
export function generateHexGrid(region, defaultRadius) {
    const r = region.radiusM ?? defaultRadius;
    const LAT_PER_M = 1 / 111_000;
    const midLat = (region.minLat + region.maxLat) / 2;
    const LNG_PER_M = 1 / (111_000 * Math.cos((midLat * Math.PI) / 180));
    // 완전 커버리지 보장: D = r√3 (최대 인접 중심 간격)
    // 행 간격 h = 3r/2, 열 간격 d = r√3, 홀수 행 오프셋 = d/2
    const rowStepDeg = r * 1.5 * LAT_PER_M; // 3r/2
    const colStepDeg = r * Math.sqrt(3) * LNG_PER_M; // r√3
    const points = [];
    let row = 0;
    for (let lat = region.minLat; lat <= region.maxLat + rowStepDeg * 0.5; lat += rowStepDeg) {
        const lngOffset = row % 2 === 1 ? colStepDeg / 2 : 0;
        let col = 0;
        for (let lng = region.minLng + lngOffset; lng <= region.maxLng + colStepDeg * 0.5; lng += colStepDeg) {
            points.push({
                name: `${region.name}-${row + 1}-${col + 1}`,
                lat: +lat.toFixed(5),
                lng: +lng.toFixed(5),
                radius: r,
            });
            col++;
        }
        row++;
    }
    return points;
}
// ── 창원시 지역 정의 (구 + 도심/농촌 분리) ──────────────────────
// 농촌·산간 지역은 radiusM을 크게 설정해 포인트 수를 줄임
const REGIONS = [
    // 성산구 — 상남동 먹자골목 포함 핵심 상권
    { district: '성산구', name: '성산구', minLat: 35.196, maxLat: 35.258, minLng: 128.655, maxLng: 128.730 },
    // 의창구 — 도심(용지·팔용·봉림)과 북면(농촌) 분리
    { district: '의창구', name: '의창구-도심', minLat: 35.236, maxLat: 35.282, minLng: 128.588, maxLng: 128.695 },
    { district: '의창구', name: '의창구-북면', minLat: 35.288, maxLat: 35.396, minLng: 128.575, maxLng: 128.660, radiusM: 2500 },
    // 마산합포구 — 오동동·창동 구도심 + 구산면 농촌
    { district: '마산합포구', name: '마산합포-도심', minLat: 35.162, maxLat: 35.222, minLng: 128.482, maxLng: 128.612 },
    { district: '마산합포구', name: '마산합포-구산면', minLat: 35.080, maxLat: 35.163, minLng: 128.448, maxLng: 128.558, radiusM: 2500 },
    // 마산회원구 — 석전동·내서읍 전체
    { district: '마산회원구', name: '마산회원', minLat: 35.185, maxLat: 35.285, minLng: 128.510, maxLng: 128.628 },
    // 진해구 — 도심과 웅동(동쪽) 분리
    { district: '진해구', name: '진해-도심', minLat: 35.125, maxLat: 35.208, minLng: 128.642, maxLng: 128.762 },
    { district: '진해구', name: '진해-웅동', minLat: 35.158, maxLat: 35.232, minLng: 128.757, maxLng: 128.848, radiusM: 2500 },
];
// ── API 요청 ──────────────────────────────────────────────────────
async function fetchKakaoCategory(categoryCode, lat, lng, radius, page) {
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
    if (!res.ok)
        throw new Error(`카카오 API ${res.status}: ${await res.text()}`);
    return res.json();
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
// ── 단일 격자점 × 카테고리 전체 수집 ─────────────────────────────
async function collectFromPoint(point, categoryCode) {
    const results = [];
    const seen = new Set();
    for (let page = 1; page <= 3; page++) {
        await sleep(250);
        try {
            const data = await fetchKakaoCategory(categoryCode, point.lat, point.lng, point.radius, page);
            for (const doc of data.documents) {
                // 창원시 외 주소 제외 (격자 경계에서 인접 시/구 유입 방지)
                const addr = doc.address_name || doc.road_address_name || '';
                if (!addr.includes('창원'))
                    continue;
                if (!seen.has(doc.id)) {
                    seen.add(doc.id);
                    results.push(doc);
                }
            }
            if (data.meta.is_end)
                break;
        }
        catch (e) {
            console.error(`  ⚠️  ${point.name} p${page}: ${e.message}`);
            break;
        }
    }
    return results;
}
// ── Supabase upsert ───────────────────────────────────────────────
async function upsertKakaoPlaces(places) {
    if (!places.length)
        return 0;
    const rows = places.map(p => ({
        kakao_place_id: p.id,
        kakao_place_url: p.place_url,
        kakao_category: p.category_name,
        unniepick_category: mapCategory(p.category_name),
        name: p.place_name,
        phone: p.phone || null,
        address: p.address_name || null,
        road_address: p.road_address_name || null,
        latitude: parseFloat(p.y) || null,
        longitude: parseFloat(p.x) || null,
        source: 'kakao',
        operating_status: 'unknown',
        crawled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
        .from('restaurants')
        .upsert(rows, { onConflict: 'kakao_place_id', ignoreDuplicates: false })
        .select('id');
    if (error) {
        console.error('  ❌ upsert:', error.message);
        return 0;
    }
    return data?.length ?? 0;
}
// ── 메인 ──────────────────────────────────────────────────────────
async function main() {
    if (!KAKAO_KEY) {
        console.error('❌ KAKAO_REST_API_KEY 없음');
        process.exit(1);
    }
    // 격자 생성
    const regions = GU_FILTER
        ? REGIONS.filter(r => r.district === GU_FILTER)
        : REGIONS;
    const allPoints = regions.flatMap(r => generateHexGrid(r, RADIUS_ARG));
    const totalCalls = allPoints.length * CATEGORIES.length * 3;
    console.log(`\n🗺️  카카오 API 수집 시작`);
    console.log(`   기본 반경: ${RADIUS_ARG}m | 격자점: ${allPoints.length}개 | 카테고리: ${CATEGORIES.length}개`);
    console.log(`   예상 요청: 최대 ${totalCalls}회 (~${Math.round(totalCalls * 0.25 / 60)}분)`);
    if (DRY_RUN)
        console.log('   [DRY-RUN] DB 저장 없음\n');
    // 격자점 목록 미리보기
    const regionSummary = regions.map(r => {
        const pts = generateHexGrid(r, RADIUS_ARG);
        return `${r.name}(${pts.length}pt)`;
    }).join(', ');
    console.log(`   지역: ${regionSummary}\n`);
    if (DRY_RUN) {
        console.log('✅ DRY-RUN 완료');
        return;
    }
    const timer = createTimer('카카오 API 수집');
    const allPlaces = new Map();
    for (let i = 0; i < allPoints.length; i++) {
        const point = allPoints[i];
        timer.step(i, allPoints.length, point.name);
        for (const cat of CATEGORIES) {
            const places = await collectFromPoint(point, cat.code);
            for (const p of places)
                allPlaces.set(p.id, p);
            await sleep(150);
        }
    }
    process.stdout.write('\n');
    // 카테고리별 집계
    const catCount = {};
    for (const p of allPlaces.values()) {
        const c = mapCategory(p.category_name);
        catCount[c] = (catCount[c] ?? 0) + 1;
    }
    timer.log(`중복 제거 후 총 ${allPlaces.size}개`);
    Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => timer.log(`  ${c.padEnd(10)}: ${n}개`));
    // 배치 upsert (100개씩)
    const arr = [...allPlaces.values()];
    let saved = 0;
    for (let i = 0; i < arr.length; i += 100) {
        saved += await upsertKakaoPlaces(arr.slice(i, i + 100));
        timer.step(i + 100, arr.length, 'DB 저장');
    }
    process.stdout.write('\n');
    timer.done(allPlaces.size, saved);
}
main().catch(console.error);
