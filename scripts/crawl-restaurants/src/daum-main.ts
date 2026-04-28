/**
 * 다음(Daum) 로컬 검색 크롤러
 *
 * 다음 로컬 검색 → 카카오맵 place URL에서 kakao_place_id 추출 → DB 저장
 * 사람처럼 느리고 랜덤하게 크롤링 (봇 탐지 회피)
 *
 * 사용법:
 *   npm run crawl:daum                           # is_daily=true 키워드 전체
 *   npm run crawl:daum -- --keyword-id=<uuid>    # 특정 키워드 1개
 *   npm run crawl:daum -- --once                 # 1회 즉시 실행
 *   npm run crawl:daum -- --once --limit=20      # 키워드당 최대 20개
 *   npm run crawl:daum -- --query="창원 카페"    # 키워드 DB 없이 즉시 검색
 *
 * 프록시:
 *   PROXY_URL=http://user:pass@host:port npm run crawl:daum -- --once
 */

import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import { getPlaywrightProxy, logProxyStatus } from './proxy.js';
import { createClient } from '@supabase/supabase-js';
import { humanDelay, microDelay, scrollDelay, createTimer } from './human-delay.js';
import {
  getActiveKeywords, updateKeywordStatus, getExistingKakaoIds,
  upsertKakaoRestaurants, type KakaoRestaurantData, type CrawlKeyword,
} from './storage.js';
import { kakaoMidCategory, normalizeToUnniepick } from './category-map.js';
import { notifyNewRestaurants } from './notify.js';

// ── Daum 검색 결과에서 추출한 업체 정보 ─────────────────────────────────────

interface DaumPlace {
  kakao_place_id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  kakao_place_url: string;
  daum_source: string;  // 검색 키워드
}

// ── Daum 로컬 검색 URL ────────────────────────────────────────────────────────

function daumSearchUrl(query: string, page = 1): string {
  const params = new URLSearchParams({ w: 'local', q: query, DA: 'LB3' });
  if (page > 1) params.set('p', String(page));
  return `https://search.daum.net/search?${params}`;
}

// ── 단일 페이지에서 업체 추출 ────────────────────────────────────────────────

async function extractPlaces(page: Page, keyword: string): Promise<DaumPlace[]> {
  return page.evaluate((kw) => {
    const results: Array<{
      kakao_place_id: string;
      name: string;
      category: string;
      address: string;
      phone: string;
      kakao_place_url: string;
      daum_source: string;
    }> = [];

    // 다음 로컬 검색 결과 컨테이너 후보 셀렉터 (구버전/신버전 대응)
    const containers = [
      ...document.querySelectorAll('.local_result_wrap .info_cont'),
      ...document.querySelectorAll('.list_place .item_place'),
      ...document.querySelectorAll('.local_result .info_place'),
      ...document.querySelectorAll('[data-v-app] .place-item'),
    ];

    for (const el of containers) {
      // 카카오맵 링크에서 place_id 추출
      const links = [...el.querySelectorAll('a[href*="place.map.kakao.com"]')];
      const kakaoUrl = links[0]?.getAttribute('href') ?? '';
      const idMatch  = kakaoUrl.match(/place\.map\.kakao\.com\/(\d+)/);
      if (!idMatch) continue;

      const kakao_place_id  = idMatch[1];
      const kakao_place_url = `https://place.map.kakao.com/${kakao_place_id}`;

      // 업체명
      const nameEl = el.querySelector(
        '.tit_place, .link_name, .tit_g a, [class*="place_name"], [class*="name"]'
      );
      const name = nameEl?.textContent?.trim() ?? '';
      if (!name) continue;

      // 카테고리
      const catEl = el.querySelector(
        '.txt_type, .txt_category, [class*="category"], .category'
      );
      const category = catEl?.textContent?.trim() ?? '';

      // 주소
      const addrEl = el.querySelector(
        '.txt_location, .txt_addr, [class*="address"], .address'
      );
      const address = addrEl?.textContent?.trim() ?? '';

      // 전화번호
      const phoneEl = el.querySelector(
        '.num_call, .tel, [class*="phone"], .phone'
      );
      const phone = phoneEl?.textContent?.trim().replace(/[^0-9-]/g, '') ?? '';

      results.push({ kakao_place_id, name, category, address, phone, kakao_place_url, daum_source: kw });
    }

    return results;
  }, keyword);
}

// ── 다음 검색에서 다음 페이지 버튼 클릭 ─────────────────────────────────────

async function goNextPage(page: Page): Promise<boolean> {
  try {
    const nextBtn = await page.$('.btn_next:not([disabled]), .paging .next:not(.disabled), a[aria-label="다음"]');
    if (!nextBtn) return false;
    await nextBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await scrollDelay();
    return true;
  } catch {
    return false;
  }
}

// ── 키워드 하나 크롤링 ───────────────────────────────────────────────────────

async function collectByKeyword(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  keyword: string,
  maxPages = 3,
): Promise<DaumPlace[]> {
  const timer  = createTimer(`"${keyword}"`);
  const page   = await browser.newPage();
  const places: DaumPlace[] = [];
  const seen   = new Set<string>();

  try {
    // User-Agent: 실제 데스크탑 Chrome
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    });
    await page.setViewportSize({ width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 100) });

    // 첫 페이지 이동
    timer.log(`다음 검색: "${keyword}"`);
    await page.goto(daumSearchUrl(keyword), { waitUntil: 'networkidle', timeout: 20_000 });
    await microDelay(500, 1200);

    // 사람처럼 스크롤
    await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 200));
    await scrollDelay();

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const pageItems = await extractPlaces(page, keyword);
      let added = 0;
      for (const p of pageItems) {
        if (!seen.has(p.kakao_place_id)) {
          seen.add(p.kakao_place_id);
          places.push(p);
          added++;
        }
      }
      timer.log(`  페이지 ${pageNum}: ${added}개 추출 (누적 ${places.length}개)`);

      if (pageNum < maxPages) {
        const hasNext = await goNextPage(page);
        if (!hasNext) break;
        // 사람처럼: 페이지 이동 후 랜덤 대기 + 스크롤
        await humanDelay(1500, 3500);
        await page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 400));
        await microDelay();
      }
    }
  } finally {
    await page.close();
  }

  timer.log(`완료 — ${places.length}개`);
  return places;
}

// ── DaumPlace → KakaoRestaurantData 변환 ────────────────────────────────────

function daumToRestaurant(p: DaumPlace): KakaoRestaurantData {
  const category         = p.category || '기타';
  const unniepick_category = normalizeToUnniepick(category);

  return {
    kakao_place_id:      p.kakao_place_id,
    kakao_place_url:     p.kakao_place_url,
    kakao_category:      p.category,
    source:              'kakao',  // Daum = Kakao 데이터
    name:                p.name,
    address:             p.address,
    phone:               p.phone,
    category,
    unniepick_category,
    tags:                [p.daum_source, '다음검색'],
  };
}

// ── 메인 크롤링 로직 ─────────────────────────────────────────────────────────

async function crawl(keywords: CrawlKeyword[]) {
  const globalTimer = createTimer('다음 전체 크롤링');
  console.log(`\n${'='.repeat(54)}`);
  console.log(`[${new Date().toLocaleString('ko-KR')}] 다음 로컬 검색 크롤링 시작`);
  console.log(`키워드 ${keywords.length}개 · 인간형 랜덤 딜레이 적용`);
  console.log(`${'='.repeat(54)}`);

  const existingIds = await getExistingKakaoIds();
  globalTimer.log(`기존 DB (카카오): ${existingIds.size}개`);
  logProxyStatus();

  const proxy   = getPlaywrightProxy();
  const maxPagesPerKw = limitArg > 0 ? Math.max(1, Math.ceil(limitArg / 10)) : 3;

  // 브라우저 1개로 순차 처리 (IP 부하 최소화)
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--lang=ko-KR',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--disable-infobars',
      '--window-size=1280,800',
    ],
    ...(proxy ? { proxy } : {}),
  });

  const allResults: KakaoRestaurantData[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    globalTimer.log(`[${i + 1}/${keywords.length}] "${kw.keyword}" 시작`);
    await updateKeywordStatus(kw.id, { status: 'running', last_error: undefined });

    try {
      const kwTimer = createTimer(`"${kw.keyword}"`);
      const places  = await collectByKeyword(browser, kw.keyword, maxPagesPerKw);
      const restaurants = places.map(p => {
        const r = daumToRestaurant(p);
        r.tags = [...new Set([...(r.tags ?? []), kw.keyword])];
        return r;
      });

      const newCount = restaurants.filter(r => !existingIds.has(r.kakao_place_id)).length;
      allResults.push(...restaurants);

      await updateKeywordStatus(kw.id, {
        status:            'success',
        last_crawled_at:   new Date().toISOString(),
        last_result_count: restaurants.length,
        last_new_count:    existingIds.size > 0 ? newCount : 0,
        current_pid:       null,
      });

      kwTimer.done(restaurants.length, newCount);

      // 키워드 간 인간형 딜레이 (4~10초)
      if (i < keywords.length - 1) {
        const wait = 4000 + Math.random() * 6000;
        globalTimer.log(`다음 키워드까지 ${(wait / 1000).toFixed(1)}초 대기...`);
        await new Promise(r => setTimeout(r, wait));
      }
    } catch (e: any) {
      globalTimer.log(`✗ "${kw.keyword}" 실패: ${e.message}`);
      await updateKeywordStatus(kw.id, {
        status:          'failed',
        last_error:      e.message,
        last_crawled_at: new Date().toISOString(),
        current_pid:     null,
      });
    }
  }

  await browser.close();

  // 중복 제거 (kakao_place_id 기준)
  const unique = new Map<string, KakaoRestaurantData>();
  for (const r of allResults) {
    const existing = unique.get(r.kakao_place_id);
    if (existing) {
      existing.tags = [...new Set([...(existing.tags ?? []), ...(r.tags ?? [])])];
    } else {
      unique.set(r.kakao_place_id, r);
    }
  }
  const deduped    = [...unique.values()];
  const newPlaces  = deduped.filter(r => !existingIds.has(r.kakao_place_id));

  globalTimer.log(`중복 제거: ${allResults.length} → ${deduped.length}개 | 신규 ${newPlaces.length}개`);

  if (newPlaces.length > 0 && existingIds.size > 0) {
    console.log(`\n🆕 신규 업체 ${newPlaces.length}개:`);
    for (const r of newPlaces.slice(0, 10)) {
      console.log(`  📍 ${r.name} (${r.category}) — ${r.address}`);
    }
  }

  if (deduped.length > 0) {
    const saved = await upsertKakaoRestaurants(deduped);
    globalTimer.log(`💾 ${saved}개 DB 저장`);
  }

  // 텔레그램 알림
  if (existingIds.size > 0 && newPlaces.length > 0) {
    for (const kw of keywords) {
      const kwNew = newPlaces.filter(r => r.tags?.includes(kw.keyword));
      if (kwNew.length > 0) await notifyNewRestaurants(kwNew, `[다음] ${kw.keyword}`);
    }
  }

  globalTimer.done(deduped.length, newPlaces.length);
  return { total: deduped.length, newCount: newPlaces.length };
}

// ── 직접 쿼리 실행 (--query 옵션) ───────────────────────────────────────────

async function runQuery(query: string) {
  console.log(`\n다음 즉시 검색: "${query}"`);
  const timer   = createTimer(query);
  const proxy   = getPlaywrightProxy();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--lang=ko-KR'],
    ...(proxy ? { proxy } : {}),
  });
  try {
    const maxPages = limitArg > 0 ? Math.max(1, Math.ceil(limitArg / 10)) : 3;
    const places   = await collectByKeyword(browser, query, maxPages);
    timer.done(places.length, 0);
    for (const p of places.slice(0, 5)) {
      console.log(`  · ${p.name} (${p.category}) ${p.phone} — ${p.address}`);
    }
  } finally {
    await browser.close();
  }
}

// ── 진입점 ──────────────────────────────────────────────────────────────────

const args          = process.argv.slice(2);
const keywordIdArg  = args.find(a => a.startsWith('--keyword-id='))?.split('=')[1];
const queryArg      = args.find(a => a.startsWith('--query='))?.split('=')[1];
const isOnce        = args.includes('--once');
// 키워드당 최대 수집 업체 수 (0 = 무제한, 기본 3페이지 × ~10개/페이지 = ~30개)
const limitArg      = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || 0;

if (queryArg) {
  await runQuery(queryArg);
  process.exit(0);
} else if (keywordIdArg) {
  const keywords = await getActiveKeywords({ id: keywordIdArg });
  await crawl(keywords);
  process.exit(0);
} else if (isOnce) {
  const keywords = await getActiveKeywords({ daily: true });
  await crawl(keywords);
  process.exit(0);
} else {
  // 스케줄러 모드 (오늘 이미 실행했으면 건너뜀)
  const lockFile = new URL('../.last-daum-crawl', import.meta.url).pathname;
  const today    = new Date().toISOString().slice(0, 10);
  let lastRun    = '';
  try { lastRun = (await import('fs')).readFileSync(lockFile, 'utf-8').trim(); } catch {}

  if (lastRun === today) {
    console.log(`[${today}] 오늘 이미 다음 크롤링 완료. 건너뜀.`);
    process.exit(0);
  }

  const delayMin = Math.floor(Math.random() * 15) + 5;  // 5~20분 후 시작 (더 랜덤하게)
  console.log(`[${today}] ${delayMin}분 후 다음 크롤링 시작 (인간형 딜레이)`);

  setTimeout(async () => {
    const keywords = await getActiveKeywords({ daily: true });
    await crawl(keywords);
    (await import('fs')).writeFileSync(lockFile, today);
    process.exit(0);
  }, delayMin * 60 * 1000);
}
