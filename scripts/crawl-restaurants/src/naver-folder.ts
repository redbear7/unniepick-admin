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
import { stealthChromium, LAUNCH_ARGS } from './stealth-browser.js';

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

async function loadCookies(page: import('playwright').Page): Promise<boolean> {
  try {
    const raw = readFileSync(COOKIE_FILE, 'utf-8');
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) return false;
    await page.context().addCookies(cookies);
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

// ── 네이버 로그인 (캐시 쿠키 → 신규 로그인 순으로 시도) ─────
async function naverLogin(page: import('playwright').Page): Promise<boolean> {
  // 1단계: 저장된 쿠키로 세션 복원 시도
  const restored = await loadCookies(page);
  if (restored) {
    // 로그인 상태 검증
    await page.goto('https://map.naver.com', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(1500);
    const isLoggedIn = await page.evaluate(() =>
      !document.cookie.includes('NNB=') || document.cookie.includes('NID_AUT=')
    );
    if (isLoggedIn) {
      console.log('✓ 쿠키 캐시로 세션 복원 성공');
      return true;
    }
    console.log('  쿠키 만료 — 재로그인 시도');
  }

  // 2단계: ID/PW로 신규 로그인
  const id = process.env.NAVER_ID;
  const pw = process.env.NAVER_PW;
  if (!id || !pw) {
    console.log('⚠️  NAVER_ID / NAVER_PW 미설정 — 로그인 생략');
    return false;
  }

  try {
    await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(1000);

    await page.fill('#id', id);
    await page.waitForTimeout(500);
    await page.fill('#pw', pw);
    await page.waitForTimeout(500);
    await page.click('#log\\.login');
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes('nid.naver.com')) {
      console.log('⚠️  네이버 로그인 실패 (captcha 또는 잘못된 계정)');
      return false;
    }

    // 로그인 성공 → 쿠키 저장 (다음 실행부터 재사용)
    await saveCookies(page);
    console.log('✓ 네이버 로그인 성공 (쿠키 저장됨)');
    return true;
  } catch (e) {
    console.log('⚠️  네이버 로그인 오류:', (e as Error).message);
    return false;
  }
}

// ── 폴더 페이지에서 place ID 추출 ────────────────────────────
async function extractPlaceIdsFromFolder(folderUrl: string): Promise<Array<{
  placeId: string;
  name: string;
  category?: string;
  address?: string;
}>> {
  const browser = await stealthChromium.launch(LAUNCH_ARGS as any);
  const page = await browser.newPage();

  // 내 장소 폴더는 로그인 필요 — 계정이 설정된 경우 먼저 로그인
  const loggedIn = await naverLogin(page);
  if (!loggedIn) {
    console.log('⚠️  비로그인 상태로 시도합니다 (공개 폴더에만 동작)');
  }

  const intercepted: Array<{ placeId: string; name: string; category?: string; address?: string }> = [];

  // 네트워크 요청 인터셉트 — 폴더 API 응답 캡처
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('favorite') && !url.includes('folder')) return;
    try {
      const ct = response.headers()['content-type'] ?? '';
      if (!ct.includes('json')) return;
      const json = await response.json();
      // 폴더 API 응답 구조 탐색
      const items: any[] = json?.result?.places ?? json?.places ?? json?.items ?? [];
      for (const item of items) {
        const placeId = item?.placeId ?? item?.id ?? item?.place_id ?? '';
        const name    = item?.name ?? item?.placeName ?? '';
        if (placeId && name) {
          intercepted.push({
            placeId: String(placeId),
            name,
            category: item?.category ?? item?.categoryName ?? undefined,
            address:  item?.address ?? item?.roadAddress ?? undefined,
          });
        }
      }
    } catch {}
  });

  console.log(`🌐 폴더 URL 로딩: ${folderUrl}`);
  try {
    await page.goto(folderUrl, { waitUntil: 'networkidle', timeout: 25_000 });
  } catch {
    await page.waitForTimeout(3000);
  }
  await page.waitForTimeout(3000);

  // Strategy 1: 네트워크 인터셉트 결과 사용
  if (intercepted.length > 0) {
    console.log(`✓ 네트워크 인터셉트: ${intercepted.length}개`);
    await browser.close();
    return intercepted;
  }

  // Strategy 2: Apollo state에서 추출
  const apolloItems = await page.evaluate(() => {
    const apollo = (window as any).__APOLLO_STATE__ ?? {};
    const results: Array<{ placeId: string; name: string; category?: string; address?: string }> = [];
    for (const [, val] of Object.entries(apollo) as [string, any][]) {
      const name = val?.name ?? val?.placeName ?? '';
      const placeId = val?.placeId ?? val?.id ?? '';
      if (!name || !placeId) continue;
      if (typeof placeId !== 'string' && typeof placeId !== 'number') continue;
      if (String(placeId).length < 5) continue;
      results.push({
        placeId: String(placeId),
        name,
        category: val?.category ?? undefined,
        address:  val?.roadAddress ?? val?.address ?? undefined,
      });
    }
    return results;
  });

  if (apolloItems.length > 0) {
    console.log(`✓ Apollo state: ${apolloItems.length}개`);
    await browser.close();
    return apolloItems;
  }

  // Strategy 3: DOM에서 /p/entry/place/{id} 링크 파싱
  const domItems = await page.evaluate(() => {
    const results: Array<{ placeId: string; name: string }> = [];
    const seen = new Set<string>();

    // 가게 카드 링크에서 place ID 추출
    document.querySelectorAll('a[href*="/entry/place/"], a[href*="/p/entry/place/"]').forEach((el) => {
      const href = el.getAttribute('href') ?? '';
      const m = href.match(/\/entry\/place\/(\d+)/);
      if (!m) return;
      const placeId = m[1];
      if (seen.has(placeId)) return;
      seen.add(placeId);

      // 가게명: 가장 가까운 텍스트 노드
      const name = (el.querySelector('[class*="name"], strong, h2, h3, span:first-child') as HTMLElement)?.innerText?.trim()
        ?? el.textContent?.trim()
        ?? '';
      if (name) results.push({ placeId, name });
    });
    return results;
  });

  console.log(`✓ DOM 파싱: ${domItems.length}개`);
  await browser.close();
  return domItems;
}

// ── 단일 place ID에서 기본 정보 수집 ─────────────────────────
async function fetchPlaceBasicInfo(page: import('playwright').Page, placeId: string): Promise<RestaurantData | null> {
  try {
    await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/home`, {
      waitUntil: 'networkidle', timeout: 20_000,
    });
    await page.waitForTimeout(2000);

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
