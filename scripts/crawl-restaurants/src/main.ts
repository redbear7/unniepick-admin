import 'dotenv/config';
import { chromium } from 'playwright';
import cron from 'node-cron';
import { upsertRestaurants, getStats, type RestaurantData } from './storage.js';

const SEARCH_QUERIES = [
  '창원 신상맛집',
  '창원 핫플 맛집',
  '창원 맛집 추천',
  '마산 맛집',
  '진해 맛집',
  '창원 카페 핫플',
  '창원 모범음식점',
  '창원 블루리본',
  '창원 새로오픈 맛집',
];

async function crawl() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${new Date().toLocaleString('ko-KR')}] 크롤링 시작`);
  console.log(`${'='.repeat(50)}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--lang=ko-KR'],
  });

  const allResults: RestaurantData[] = [];

  try {
    for (const query of SEARCH_QUERIES) {
      console.log(`\n  🔍 "${query}"`);
      const page = await browser.newPage();

      try {
        // 검색 결과 목록에서 place ID 수집 (페이지네이션 포함)
        const placeIds = await collectPlaceIds(page, query);
        console.log(`     ${placeIds.length}개 ID 수집`);

        // 각 상세 페이지에서 정보 추출
        for (let i = 0; i < placeIds.length; i++) {
          const id = placeIds[i];
          try {
            const data = await crawlDetail(page, id);
            if (data) {
              allResults.push(data);
            }
          } catch {
            // 개별 실패는 무시
          }
          // 과부하 방지
          await page.waitForTimeout(500 + Math.random() * 500);
        }
      } catch (e) {
        console.log(`     에러: ${(e as Error).message}`);
      }

      await page.close();
      console.log(`     완료 (누적 ${allResults.length}개)`);
    }
  } finally {
    await browser.close();
  }

  // 중복 제거 (naver_place_id 기준)
  const unique = new Map<string, RestaurantData>();
  for (const r of allResults) {
    unique.set(r.naver_place_id, r);
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

/** 검색 결과 페이지에서 __APOLLO_STATE__를 통해 place ID 수집 */
async function collectPlaceIds(page: any, query: string): Promise<string[]> {
  const allIds = new Set<string>();

  for (let pageNum = 0; pageNum < 5; pageNum++) {
    const url = pageNum === 0
      ? `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`
      : null; // 페이지네이션은 버튼 클릭으로 처리

    if (pageNum === 0) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });
    }
    await page.waitForTimeout(2000);

    // __APOLLO_STATE__ + script 태그에서 ID 추출
    const ids: string[] = await page.evaluate(() => {
      const found = new Set<string>();

      // Apollo cache
      const apollo = (window as any).__APOLLO_STATE__;
      if (apollo) {
        for (const key of Object.keys(apollo)) {
          const m = key.match(/^Place:(\d{7,})$/);
          if (m) found.add(m[1]);
        }
      }

      // script 내 JSON
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

    if (allIds.size === prevSize && pageNum > 0) break; // 새 결과 없으면 중단

    // 다음 페이지
    if (pageNum < 4) {
      const nextBtn = await page.$('a:has-text("다음페이지"), button:has-text("다음페이지")');
      if (!nextBtn) break;
      await nextBtn.click();
      await page.waitForTimeout(2000);
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

    // 메뉴
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

/** 카테고리/이름 기반 태그 추론 */
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

// ── 실행 ──
const isOnce = process.argv.includes('--once');
if (isOnce) {
  crawl().catch(console.error);
} else {
  console.log('스케줄러 시작 (매일 06:00)');
  crawl().catch(console.error);
  cron.schedule('0 6 * * *', () => crawl().catch(console.error));
}
