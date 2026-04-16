import { createPlaywrightRouter } from 'crawlee';
import type { RestaurantData } from './storage.js';

export const router = createPlaywrightRouter();

/**
 * 검색 결과 목록 페이지 핸들러
 * 네이버 플레이스 검색 결과에서 각 맛집의 상세 링크를 수집
 */
router.addDefaultHandler(async ({ page, log, crawler }) => {
  log.info('검색 결과 페이지 로딩...');

  // 검색 결과가 로딩될 때까지 대기
  await page.waitForSelector('#_pcmap_list_scroll_container', { timeout: 15_000 }).catch(() => {
    log.warning('검색 결과 컨테이너를 찾을 수 없습니다. 셀렉터 변경 가능성');
  });

  // 무한스크롤로 더 많은 결과 로딩 (최대 5회)
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const container = document.querySelector('#_pcmap_list_scroll_container');
      if (container) container.scrollTop = container.scrollHeight;
    });
    await page.waitForTimeout(1500);
  }

  // 각 맛집 리스트 아이템에서 place ID 추출
  const placeLinks = await page.$$eval(
    'a[href*="/restaurant/"], a[href*="/place/"]',
    (anchors) => {
      const ids = new Set<string>();
      for (const a of anchors) {
        const href = a.getAttribute('href') ?? '';
        const match = href.match(/\/(?:restaurant|place)\/(\d{5,})/);
        if (match) ids.add(match[1]);
      }
      return [...ids];
    },
  );

  log.info(`${placeLinks.length}개 맛집 발견`);

  // 각 상세 페이지를 크롤링 큐에 추가
  for (const placeId of placeLinks) {
    await crawler.addRequests([{
      url: `https://pcmap.place.naver.com/restaurant/${placeId}/home`,
      label: 'DETAIL',
      userData: { placeId },
    }]);
  }
});

/**
 * 맛집 상세 페이지 핸들러
 * 개별 맛집 페이지에서 상세 정보 추출
 */
router.addHandler('DETAIL', async ({ page, request, log }) => {
  const { placeId } = request.userData as { placeId: string };
  log.info(`상세 페이지 크롤링: ${placeId}`);

  await page.waitForTimeout(2000); // 페이지 렌더링 대기

  const data = await page.evaluate(() => {
    const getText = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? '';
    const getMeta = (prop: string) => {
      const el = document.querySelector(`meta[property="${prop}"]`);
      return el?.getAttribute('content') ?? '';
    };

    // 이름
    const rawTitle = getMeta('og:title');
    const name = rawTitle.replace(/\s*:\s*네이버.*$/, '').trim();

    // 주소
    const addressEl = document.querySelector('[class*="addr"]') ??
                      document.querySelector('[data-kakaotalk-description]');
    const address = addressEl?.getAttribute('data-kakaotalk-description') ??
                    addressEl?.textContent?.trim() ?? '';

    // 전화번호
    const phoneMatch = document.body.innerHTML.match(/0\d{1,3}-\d{3,4}-\d{4}/);
    const phone = phoneMatch?.[0] ?? '';

    // 카테고리
    const catMatch = document.body.innerHTML.match(/"category"\s*:\s*"([^"]{2,30})"/);
    const category = catMatch?.[1] ?? '';

    // 평점
    const ratingEl = document.querySelector('[class*="PXMot"] em, .LXIwF em, [class*="star_score"] em');
    const rating = ratingEl ? parseFloat(ratingEl.textContent ?? '0') : undefined;

    // 리뷰 수 추출
    const reviewMatch = document.body.innerHTML.match(/"visitorReviewCount"\s*:\s*(\d+)/);
    const visitorReviewCount = reviewMatch ? parseInt(reviewMatch[1]) : 0;

    const blogReviewMatch = document.body.innerHTML.match(/"reviewCount"\s*:\s*(\d+)/);
    const reviewCount = blogReviewMatch ? parseInt(blogReviewMatch[1]) : 0;

    // 이미지
    const rawImage = getMeta('og:image');
    const imgSrcMatch = rawImage.match(/[?&]src=([^&]+)/);
    const image_url = imgSrcMatch ? decodeURIComponent(imgSrcMatch[1]) : rawImage;

    // 좌표
    const latMatch = document.body.innerHTML.match(/"y"\s*:\s*"?([\d.]+)"?/);
    const lngMatch = document.body.innerHTML.match(/"x"\s*:\s*"?([\d.]+)"?/);
    const latitude = latMatch ? parseFloat(latMatch[1]) : undefined;
    const longitude = lngMatch ? parseFloat(lngMatch[1]) : undefined;

    // 메뉴
    const menuItems: Array<{ name: string; price?: string }> = [];
    document.querySelectorAll('[class*="menu_item"], [class*="item_info"]').forEach((el) => {
      const menuName = el.querySelector('[class*="name"]')?.textContent?.trim();
      const menuPrice = el.querySelector('[class*="price"]')?.textContent?.trim();
      if (menuName) menuItems.push({ name: menuName, price: menuPrice ?? undefined });
    });

    return { name, address, phone, category, rating, reviewCount, visitorReviewCount, image_url, latitude, longitude, menuItems };
  });

  if (!data.name) {
    log.warning(`이름을 추출할 수 없음: ${placeId}`);
    return;
  }

  const result: RestaurantData = {
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
    menu_items: data.menuItems.slice(0, 5),
    tags: inferTags(data.category ?? '', data.name),
  };

  // request.userData에 결과 저장 (main.ts에서 일괄 처리)
  request.userData.result = result;
});

/** 카테고리/이름으로 태그 자동 추론 */
function inferTags(category: string, name: string): string[] {
  const tags: string[] = [];
  const text = `${category} ${name}`;

  const tagMap: Record<string, string[]> = {
    '한식': ['한식'],
    '일식': ['일식', '초밥', '라멘', '돈카츠'],
    '중식': ['중식', '짜장', '짬뽕'],
    '양식': ['양식', '파스타', '피자', '스테이크'],
    '카페': ['카페', '디저트', '커피'],
    '분식': ['분식', '떡볶이'],
    '치킨': ['치킨'],
    '고기': ['고기', '삼겹살', '소고기', '갈비'],
    '해물': ['해물', '회', '초밥'],
    '베이커리': ['베이커리', '빵'],
    '브런치': ['브런치'],
  };

  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some((kw) => text.includes(kw))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}
