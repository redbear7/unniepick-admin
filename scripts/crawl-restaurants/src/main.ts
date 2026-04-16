import 'dotenv/config';
import { chromium } from 'playwright';
import cron from 'node-cron';
import { upsertRestaurants, getStats, type RestaurantData } from './storage.js';

// ── 검색어 설정 ──────────────────────────────────────────────

/** 매일 크롤링: 새로오픈 */
const DAILY_QUERIES = [
  '창원시 새로오픈 맛집',
];

/** 동별 크롤링: 주요 상권 (--district 모드) */
const DISTRICT_QUERIES = [
  '상남동', '중앙동', '용호동', '팔용동',
  '명곡동', '사파동', '봉곡동', '대방동',
  '산호동', '합성동', '석전동', '반림동',
  '교방동', '자은동', '두대동', '북면',
  // 마산
  '마산합포구', '오동동', '창동', '양덕동',
  // 진해
  '진해구', '충무동', '여좌동', '풍호동',
];

/** 테스트용 (--test) */
const TEST_QUERIES = ['상남동'];

// ── 크롤링 코어 ─────────────────────────────────────────────

async function crawl(queries: string[], mode: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${new Date().toLocaleString('ko-KR')}] 크롤링 시작 (${mode})`);
  console.log(`검색어 ${queries.length}개: ${queries.join(', ')}`);
  console.log(`${'='.repeat(50)}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--lang=ko-KR'],
  });

  const allResults: RestaurantData[] = [];

  try {
    for (const q of queries) {
      // 동별 검색이면 "창원시 {동} 맛집" 형식으로
      const query = mode === 'daily' ? q : `창원시 ${q} 맛집`;
      console.log(`\n  🔍 "${query}"`);

      const page = await browser.newPage();

      try {
        // 1~5페이지 place ID 수집
        const placeIds = await collectPlaceIds(page, query);
        console.log(`     ${placeIds.length}개 ID 수집`);

        // 각 상세 페이지 크롤링
        let count = 0;
        for (const id of placeIds) {
          try {
            const data = await crawlDetail(page, id);
            if (data) {
              // 동별 태그 추가
              if (mode !== 'daily') data.tags = [...(data.tags ?? []), q];
              allResults.push(data);
              count++;
            }
          } catch { /* 개별 실패 무시 */ }
          await page.waitForTimeout(400 + Math.random() * 400);
        }
        console.log(`     ✓ ${count}개 추출 (누적 ${allResults.length}개)`);
      } catch (e) {
        console.log(`     ✗ 에러: ${(e as Error).message}`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  // 중복 제거
  const unique = new Map<string, RestaurantData>();
  for (const r of allResults) {
    const existing = unique.get(r.naver_place_id);
    if (existing) {
      // 태그 병합
      existing.tags = [...new Set([...(existing.tags ?? []), ...(r.tags ?? [])])];
    } else {
      unique.set(r.naver_place_id, r);
    }
  }
  const deduped = [...unique.values()];
  console.log(`\n중복 제거: ${allResults.length} → ${deduped.length}개`);

  if (deduped.length > 0) {
    const saved = await upsertRestaurants(deduped);
    console.log(`✅ ${saved}개 DB 저장`);
  }

  const stats = await getStats();
  console.log(`📊 DB 총: ${stats.total}개\n`);
}

/** 검색 결과 1~5페이지에서 __APOLLO_STATE__ 기반 place ID 수집 */
async function collectPlaceIds(page: any, query: string): Promise<string[]> {
  const allIds = new Set<string>();

  // 첫 페이지 로딩
  await page.goto(
    `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`,
    { waitUntil: 'networkidle', timeout: 20_000 },
  );
  await page.waitForTimeout(2500);

  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    // ID 추출
    const ids: string[] = await page.evaluate(() => {
      const found = new Set<string>();
      const apollo = (window as any).__APOLLO_STATE__;
      if (apollo) {
        for (const key of Object.keys(apollo)) {
          const m = key.match(/^Place:(\d{7,})$/);
          if (m) found.add(m[1]);
        }
      }
      for (const s of document.querySelectorAll('script')) {
        const text = s.textContent ?? '';
        for (const m of text.matchAll(/"id"\s*:\s*"(\d{7,})"/g)) {
          found.add(m[1]);
        }
      }
      return [...found];
    });

    const prevSize = allIds.size;
    for (const id of ids) allIds.add(id);
    const newCount = allIds.size - prevSize;

    console.log(`     페이지 ${pageNum}: +${newCount}개 (누적 ${allIds.size}개)`);

    if (pageNum < 5) {
      // 다음 페이지 버튼 클릭
      const nextBtn = await page.$('a:has-text("다음페이지"), button:has-text("다음페이지")');
      if (!nextBtn) {
        console.log(`     (마지막 페이지)`);
        break;
      }
      await nextBtn.click();
      await page.waitForTimeout(2500);
    }
  }

  return [...allIds];
}

/** 상세 페이지에서 맛집 정보 추출 */
async function crawlDetail(page: any, placeId: string): Promise<RestaurantData | null> {
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/home`, {
    waitUntil: 'networkidle',
    timeout: 15_000,
  });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const getMeta = (prop: string) =>
      document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? '';

    const name = getMeta('og:title').replace(/\s*:\s*네이버.*$/, '').trim();
    const addrEl = document.querySelector('[data-kakaotalk-description]');
    const address = addrEl?.getAttribute('data-kakaotalk-description')?.replace(/&amp;/g, '&').trim() ?? '';
    const phoneMatch = document.body.innerHTML.match(/0\d{1,3}-\d{3,4}-\d{4}/);
    const phone = phoneMatch?.[0] ?? '';
    const catMatch = document.body.innerHTML.match(/"category"\s*:\s*"([^"]{2,30})"/);
    const category = catMatch?.[1] ?? '';
    const ratingEl = document.querySelector('[class*="PXMot"] em, .LXIwF em');
    const rating = ratingEl ? parseFloat(ratingEl.textContent ?? '0') : undefined;
    const visitorMatch = document.body.innerHTML.match(/"visitorReviewCount"\s*:\s*(\d+)/);
    const visitorReviewCount = visitorMatch ? parseInt(visitorMatch[1]) : 0;
    const blogMatch = document.body.innerHTML.match(/"reviewCount"\s*:\s*(\d+)/);
    const reviewCount = blogMatch ? parseInt(blogMatch[1]) : 0;
    const rawImage = getMeta('og:image');
    const imgSrc = rawImage.match(/[?&]src=([^&]+)/);
    const image_url = imgSrc ? decodeURIComponent(imgSrc[1]) : rawImage;
    const latMatch = document.body.innerHTML.match(/"y"\s*:\s*"?([\d.]+)"?/);
    const lngMatch = document.body.innerHTML.match(/"x"\s*:\s*"?([\d.]+)"?/);
    const latitude = latMatch ? parseFloat(latMatch[1]) : undefined;
    const longitude = lngMatch ? parseFloat(lngMatch[1]) : undefined;

    const menuItems: Array<{ name: string; price?: string }> = [];
    document.querySelectorAll('[class*="menu_item"], [class*="item_info"]').forEach((el) => {
      const n = el.querySelector('[class*="name"]')?.textContent?.trim();
      const p = el.querySelector('[class*="price"]')?.textContent?.trim();
      if (n) menuItems.push({ name: n, price: p ?? undefined });
    });

    return {
      name, address, phone, category, rating,
      reviewCount, visitorReviewCount,
      image_url, latitude, longitude,
      menuItems: menuItems.slice(0, 5),
    };
  });

  if (!data.name) return null;

  return {
    naver_place_id: placeId,
    name: data.name,
    address: data.address || undefined,
    phone: data.phone || undefined,
    category: data.category || undefined,
    rating: data.rating,
    review_count: data.reviewCount,
    visitor_review_count: data.visitorReviewCount,
    latitude: data.latitude,
    longitude: data.longitude,
    image_url: data.image_url || undefined,
    naver_place_url: `https://map.naver.com/p/entry/place/${placeId}`,
    menu_items: data.menuItems,
    tags: inferTags(data.category ?? '', data.name),
  };
}

function inferTags(category: string, name: string): string[] {
  const text = `${category} ${name}`;
  const tagMap: Record<string, string[]> = {
    '한식': ['한식'], '일식': ['일식', '초밥', '라멘', '돈카츠'],
    '중식': ['중식', '짜장', '짬뽕'], '양식': ['양식', '파스타', '피자', '스테이크'],
    '카페': ['카페', '디저트', '커피'], '분식': ['분식', '떡볶이'],
    '치킨': ['치킨'], '고기': ['고기', '삼겹살', '소고기', '갈비'],
    '해물': ['해물', '회'], '베이커리': ['베이커리', '빵'], '브런치': ['브런치'],
  };
  const tags = new Set<string>();
  for (const [tag, kws] of Object.entries(tagMap)) {
    if (kws.some((kw) => text.includes(kw))) tags.add(tag);
  }
  return [...tags];
}

// ── 실행 모드 ────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args.includes('--test') ? 'test'
  : args.includes('--district') ? 'district'
  : args.includes('--once') ? 'daily'
  : 'scheduler';

if (mode === 'test') {
  // 테스트: 상남동만
  crawl(TEST_QUERIES, 'district').catch(console.error);

} else if (mode === 'district') {
  // 전체 동별 크롤링
  crawl(DISTRICT_QUERIES, 'district').catch(console.error);

} else if (mode === 'daily') {
  // 1회 새로오픈 크롤링
  crawl(DAILY_QUERIES, 'daily').catch(console.error);

} else {
  // 스케줄러: 매일 06:00 새로오픈, 매주 월요일 03:00 전체 동별
  console.log('스케줄러 시작');
  console.log('  - 매일 06:00: 새로오픈 맛집');
  console.log('  - 매주 월 03:00: 전체 동별 크롤링');

  crawl(DAILY_QUERIES, 'daily').catch(console.error);

  cron.schedule('0 6 * * *', () => crawl(DAILY_QUERIES, 'daily').catch(console.error));
  cron.schedule('0 3 * * 1', () => crawl(DISTRICT_QUERIES, 'district').catch(console.error));
}
