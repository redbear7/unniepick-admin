import 'dotenv/config';
import { chromium } from 'playwright';
import cron from 'node-cron';
import { crawlChangwonTour } from './sources/changwon-tour.js';
import { crawlBlueRibbon } from './sources/blueribbon.js';
import { crawlPublicData } from './sources/public-data.js';
import { verifyWithNaver } from './sources/naver-verify.js';
import { upsertRestaurants, getStats, type RestaurantData } from './storage.js';

async function crawl() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${new Date().toLocaleString('ko-KR')}] 창원 맛집 크롤링 시작`);
  console.log(`${'='.repeat(60)}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--lang=ko-KR'],
  });

  try {
    const allResults: RestaurantData[] = [];

    // ── 1단계: 다중 소스에서 수집 ──────────────────────────────
    console.log('\n[1/3] 데이터 소스 수집');

    // 1-1. 창원시 관광포털
    console.log('\n  📌 창원시 관광포털');
    try {
      const page1 = await browser.newPage();
      const tourResults = await crawlChangwonTour(page1);
      allResults.push(...tourResults);
      await page1.close();
    } catch (e) {
      console.log(`  ✗ 창원관광포털 에러: ${(e as Error).message}`);
    }

    // 1-2. 블루리본 서베이
    console.log('\n  📌 블루리본 서베이');
    try {
      const page2 = await browser.newPage();
      const brResults = await crawlBlueRibbon(page2);
      allResults.push(...brResults);
      await page2.close();
    } catch (e) {
      console.log(`  ✗ 블루리본 에러: ${(e as Error).message}`);
    }

    // 1-3. 공공데이터 모범음식점
    console.log('\n  📌 공공데이터 모범음식점');
    try {
      const pubResults = await crawlPublicData();
      allResults.push(...pubResults);
    } catch (e) {
      console.log(`  ✗ 공공데이터 에러: ${(e as Error).message}`);
    }

    console.log(`\n  수집 합계: ${allResults.length}개`);

    if (allResults.length === 0) {
      console.log('  수집 결과가 없습니다. 종료.');
      return;
    }

    // ── 2단계: 이름 기반 중복 제거 ──────────────────────────────
    console.log('\n[2/3] 중복 제거');
    const unique = deduplicateByName(allResults);
    console.log(`  중복 제거 후: ${unique.length}개`);

    // ── 3단계: 네이버 플레이스 검증 ─────────────────────────────
    console.log('\n[3/3] 네이버 플레이스 검증 (영업 확인 + 주소/좌표 보강)');
    const verifyPage = await browser.newPage();
    const verified = await verifyWithNaver(verifyPage, unique);
    await verifyPage.close();

    // ── 저장 ───────────────────────────────────────────────────
    if (verified.length > 0) {
      const saved = await upsertRestaurants(verified);
      console.log(`\n✅ ${saved}개 맛집 DB 저장 완료`);
    }

    const stats = await getStats();
    console.log(`📊 DB 총 맛집 수: ${stats.total}개`);

  } finally {
    await browser.close();
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

/** 이름 기반 중복 제거 (태그 병합) */
function deduplicateByName(items: RestaurantData[]): RestaurantData[] {
  const map = new Map<string, RestaurantData>();

  for (const item of items) {
    // 정규화: 공백/특수문자 제거하여 비교
    const key = item.name.replace(/\s+/g, '').toLowerCase();
    const existing = map.get(key);

    if (existing) {
      // 태그 병합
      const mergedTags = [...new Set([...(existing.tags ?? []), ...(item.tags ?? [])])];
      map.set(key, {
        ...existing,
        tags: mergedTags,
        address: existing.address || item.address,
        phone: existing.phone || item.phone,
        category: existing.category || item.category,
      });
    } else {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

// ── 실행 ──────────────────────────────────────────────────────
const isOnce = process.argv.includes('--once');

if (isOnce) {
  crawl().catch(console.error);
} else {
  console.log('크롤링 스케줄러 시작 (매일 06:00)');
  crawl().catch(console.error);

  cron.schedule('0 6 * * *', () => {
    crawl().catch(console.error);
  });
}
