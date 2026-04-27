/**
 * naver-folder.ts — 네이버 내 장소 폴더 크롤링
 *
 * 사용법:
 *   tsx src/naver-folder.ts --url="https://map.naver.com/p/favorite/myPlace/folder/xxx"
 *
 * 동작:
 *   1. 폴더 URL에서 place ID 목록 추출
 *   2. DB에 없는 신규 업체만 필터
 *   3. 각 업체 상세 정보(crawlDetailInfo) 수집
 *   4. restaurants + stores 테이블에 저장
 */
import 'dotenv/config';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { crawlDetailInfo } from './main.js';
import { processImage } from './image.js';
import { autoTagRestaurant } from './tagger.js';
import { upsertRestaurants, type RestaurantData } from './storage.js';
import { stealthChromium, LAUNCH_ARGS, injectStealth, waitForApollo } from './stealth-browser.js';

const RESULT_FILE  = path.join(new URL('../logs/folder-result.json', import.meta.url).pathname);
const COOKIE_FILE  = path.join(new URL('../logs/naver-cookies.json',  import.meta.url).pathname);
const LOGS_DIR     = path.dirname(RESULT_FILE);

// ── 쿠키 저장/복원 (로그인 1회화) ────────────────────────────
async function saveCookies(page: import('playwright').Page): Promise<void> {
  try {
    const cookies = await page.context().cookies();
    mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2), 'utf-8');
  } catch {}
}

async function loadCookies(ctx: import('playwright').BrowserContext): Promise<boolean> {
  try {
    const raw = readFileSync(COOKIE_FILE, 'utf-8');
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    await ctx.addCookies(cookies);
    return true;
  } catch {
    return false;
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function writeResult(payload: object) {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(RESULT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch {}
}

// ── DB에 이미 있는 naver_place_id 목록 ──────────────────────
async function getExistingIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from('restaurants')
    .select('naver_place_id');
  return new Set((data ?? []).map((r: any) => r.naver_place_id));
}

// ── 네이버 로그인 (쿠키 캐시 → NAVER_ID/PW 순으로 시도) ─────
async function naverLogin(page: import('playwright').Page): Promise<boolean> {
  // 1단계: 저장된 쿠키로 세션 복원 시도
  const restored = await loadCookies(page.context());
  if (restored) {
    await page.goto('https://map.naver.com', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(1500);
    if (!page.url().includes('nid.naver.com')) {
      console.log('✓ 쿠키 캐시로 세션 복원 성공');
      return true;
    }
    console.log('  쿠키 만료 — ID/PW로 재로그인 시도');
  }

  // 2단계: NAVER_ID / NAVER_PW로 로그인
  const id = process.env.NAVER_ID;
  const pw = process.env.NAVER_PW;
  if (!id || !pw) {
    console.log('⚠️  로그인 방법 없음. 아래 중 하나를 선택하세요:');
    console.log('    a) npx tsx src/naver-login-setup.ts  (수동 로그인 후 쿠키 저장)');
    console.log('    b) .env에 NAVER_ID= / NAVER_PW= 추가');
    return false;
  }

  try {
    await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForSelector('#id', { timeout: 5_000 });
    await page.fill('#id', id);
    await page.fill('#pw', pw);
    await page.click('#log\\.login');
    // 로그인 후 URL 변경 대기 (최대 10초)
    try {
      await page.waitForURL((url) => !url.href.includes('nid.naver.com'), { timeout: 10_000 });
    } catch { /* URL 변경 없으면 실패로 처리 */ }

    if (page.url().includes('nid.naver.com')) {
      console.log('⚠️  로그인 실패 (captcha 또는 잘못된 계정)');
      return false;
    }

    await saveCookies(page);
    console.log('✓ 네이버 로그인 성공 (쿠키 저장됨)');
    return true;
  } catch (e) {
    console.log('⚠️  로그인 오류:', (e as Error).message);
    return false;
  }
}

// ── 북마크 API 직접 호출로 폴더 내 업체 전체 수집 ───────────
// API: GET https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/{hash}/bookmarks
// - placeInfo=true : 썸네일·카테고리 포함 (limit 최대 20)
// - 페이지네이션: start=0,20,40 ...
async function extractPlaceIdsFromFolder(folderUrl: string): Promise<Array<{
  placeId:   string;
  name:      string;
  category?: string;
  address?:  string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
}>> {
  // 폴더 해시 추출 (URL 마지막 path segment)
  const hashMatch = folderUrl.match(/folder\/([a-f0-9]+)/);
  if (!hashMatch) throw new Error(`폴더 URL에서 hash를 추출할 수 없습니다: ${folderUrl}`);
  const folderHash = hashMatch[1];

  const browser = await stealthChromium.launch(LAUNCH_ARGS as any);
  const context = await browser.newContext();
  await injectStealth(context); // 컨텍스트 전체에 stealth 주입

  // 쿠키 로드 (로그인 세션 복원)
  const cookiesLoaded = await loadCookies(context);
  if (!cookiesLoaded) {
    console.log('⚠️  저장된 쿠키 없음 — 먼저 실행하세요: npm run naver:login');
    await browser.close();
    return [];
  }
  console.log('✓ 쿠키 세션 복원');

  const BASE = 'https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares';
  const all: Array<{
    placeId: string; name: string; category?: string;
    address?: string; latitude?: number; longitude?: number; imageUrl?: string;
  }> = [];
  let start = 0;
  const LIMIT = 20;

  console.log(`📋 북마크 API 페이지네이션 수집 시작`);

  while (true) {
    const url = `${BASE}/${folderHash}/bookmarks?placeInfo=true&start=${start}&limit=${LIMIT}&sort=lastUseTime&mcids=ALL&createIdNo=true`;
    const res = await context.request.get(url, {
      headers: { 'Referer': 'https://map.naver.com/', 'Accept': 'application/json' },
    });

    if (!res.ok()) {
      console.log(`  ⚠️  API 오류 (start=${start}): HTTP ${res.status()}`);
      break;
    }

    const json = await res.json() as any;
    const items: any[] = json?.bookmarkList ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const placeId = item?.sid ?? '';          // sid = 네이버 place ID
      const name    = item?.name ?? '';
      if (!placeId || !name) continue;

      all.push({
        placeId:   String(placeId),
        name,
        category:  item?.placeInfo?.category ?? item?.mcidName ?? undefined,
        address:   item?.address ?? undefined,
        latitude:  typeof item?.py === 'number' ? item.py : undefined,
        longitude: typeof item?.px === 'number' ? item.px : undefined,
        imageUrl:  item?.placeInfo?.thumbnailUrls?.[0] ?? undefined,
      });
    }

    console.log(`  start=${start}: ${items.length}개 수집 (누적 ${all.length}개)`);

    // 다음 페이지 여부: bookmarkCount 기준
    const total = json?.folder?.bookmarkCount ?? 0;
    start += LIMIT;
    if (start >= total || items.length < LIMIT) break;

    await new Promise(r => setTimeout(r, 300)); // 짧은 딜레이
  }

  await browser.close();
  console.log(`✅ 총 ${all.length}개 수집 완료`);
  return all;
}

// ── 단일 place ID에서 기본 정보 수집 ─────────────────────────
async function fetchPlaceBasicInfo(page: import('playwright').Page, placeId: string): Promise<RestaurantData | null> {
  try {
    await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/home`, {
      waitUntil: 'networkidle', timeout: 20_000,
    });
    await waitForApollo(page);

    return await page.evaluate((pid) => {
      const apollo = (window as any).__APOLLO_STATE__ ?? {};
      for (const [, val] of Object.entries(apollo) as [string, any][]) {
        const name = val?.name ?? '';
        if (!name) continue;
        if (val?.roadAddress || val?.address) {
          return {
            naver_place_id: pid,
            name,
            address: val.roadAddress
              ? `${val.commonAddress ?? ''} ${val.roadAddress}`.trim()
              : val.address ?? '',
            phone:    val.virtualPhone ?? val.phone ?? '',
            category: val.category ?? '',
            latitude: val.y ? parseFloat(val.y) : undefined,
            longitude: val.x ? parseFloat(val.x) : undefined,
            image_url: val.imageUrl ?? val.thumUrl ?? '',
            visitor_review_count: parseInt((val.visitorReviewCount ?? '0').replace(/,/g, '')) || 0,
            review_count: parseInt((val.blogCafeReviewCount ?? val.totalReviewCount ?? '0').replace(/,/g, '')) || 0,
            naver_place_url: `https://map.naver.com/p/entry/place/${pid}`,
          } as any;
        }
      }
      return null;
    }, placeId);
  } catch {
    return null;
  }
}

// ── 메인 ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const urlArg = args.find(a => a.startsWith('--url='))?.split('=').slice(1).join('=');

if (!urlArg) {
  console.error('❌ --url="https://map.naver.com/p/favorite/myPlace/folder/xxx" 필요');
  process.exit(1);
}

const folderUrl = urlArg.trim();
console.log(`\n${'─'.repeat(55)}`);
console.log(`네이버 폴더 크롤링`);
console.log(`URL: ${folderUrl}`);
console.log(`${'─'.repeat(55)}\n`);

// 1. 폴더에서 place ID 목록 추출
const folderItems = await extractPlaceIdsFromFolder(folderUrl);
console.log(`\n📋 폴더 내 업체: ${folderItems.length}개`);

if (folderItems.length === 0) {
  const msg = '폴더에서 업체를 찾을 수 없습니다. 폴더가 비공개이거나 URL이 올바르지 않을 수 있습니다.';
  console.error(`❌ ${msg}`);
  writeResult({ status: 'failed', error: msg, total: 0, newCount: 0, finishedAt: new Date().toISOString() });
  process.exit(1);
}

// 2. DB에 이미 있는 ID 제외
const existingIds = await getExistingIds();
const newItems = folderItems.filter(f => !existingIds.has(f.placeId));
const alreadyCount = folderItems.length - newItems.length;

console.log(`✓ 이미 등록됨: ${alreadyCount}개`);
console.log(`✓ 신규 업체:   ${newItems.length}개\n`);

if (newItems.length === 0) {
  console.log('✅ 모두 이미 등록된 업체입니다.');
  writeResult({
    status: 'success',
    total: folderItems.length,
    alreadyCount,
    newCount: 0,
    saved: [],
    finishedAt: new Date().toISOString(),
  });
  process.exit(0);
}

// 3. 신규 업체 상세 크롤링
const browser2 = await stealthChromium.launch(LAUNCH_ARGS as any);
const page2 = await browser2.newPage();
await injectStealth(page2); // stealth 주입
const saved: Array<{ placeId: string; name: string }> = [];
const failed: Array<{ placeId: string; name: string; error: string }> = [];

for (let i = 0; i < newItems.length; i++) {
  const item = newItems[i];
  console.log(`[${i + 1}/${newItems.length}] ${item.name} (${item.placeId})`);

  try {
    // 기본 정보 수집
    let store: RestaurantData | null = await fetchPlaceBasicInfo(page2, item.placeId);
    if (!store) {
      store = {
        naver_place_id: item.placeId,
        name: item.name,
        category: item.category ?? '',
        address: item.address ?? '',
        phone: '',
        image_url: '',
        naver_place_url: `https://map.naver.com/p/entry/place/${item.placeId}`,
        visitor_review_count: 0,
        review_count: 0,
      };
    }

    // 상세 정보 (영업시간, 홈페이지, 메뉴)
    const detail = await crawlDetailInfo(page2, item.placeId);
    if (detail.business_hours)        store.business_hours = detail.business_hours;
    if (detail.business_hours_detail) store.business_hours_detail = detail.business_hours_detail;
    if (detail.website_url)           store.website_url = detail.website_url;
    if (detail.instagram_url)         store.instagram_url = detail.instagram_url;
    if (detail.menu_items?.length)    store.menu_items = detail.menu_items;

    // 이미지 처리
    if (store.image_url) {
      try {
        const { url } = await processImage(store.image_url, store.naver_place_id);
        store.image_url = url;
      } catch {}
    }

    // 태그
    store.tags = ['창원맛집'];
    store.auto_tags = autoTagRestaurant(store);

    // DB 저장
    await upsertRestaurants([store]);
    saved.push({ placeId: item.placeId, name: store.name });
    console.log(`  ✓ 저장 완료`);
  } catch (e) {
    const err = (e as Error).message;
    failed.push({ placeId: item.placeId, name: item.name, error: err });
    console.log(`  ✗ 실패: ${err}`);
  }

  await page2.waitForTimeout(800 + Math.random() * 400);
}

await browser2.close();

console.log(`\n${'─'.repeat(55)}`);
console.log(`✅ 완료 — 저장 ${saved.length}개 / 실패 ${failed.length}개`);

writeResult({
  status: 'success',
  total: folderItems.length,
  alreadyCount,
  newCount: newItems.length,
  savedCount: saved.length,
  failedCount: failed.length,
  saved,
  failed,
  finishedAt: new Date().toISOString(),
});

process.exit(0);
