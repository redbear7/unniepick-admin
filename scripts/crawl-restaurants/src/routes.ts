import type { PlaywrightCrawlingContext } from 'crawlee';
import type { RestaurantData } from './storage.js';

/**
 * 검색 결과 목록 핸들러
 * 네이버 플레이스 검색 결과에서 각 맛집의 place ID를 수집하고 상세 크롤링 큐에 추가
 */
export async function createListHandler(ctx: PlaywrightCrawlingContext) {
  const { page, log, crawler } = ctx;
  log.info('검색 결과 페이지 로딩...');

  // 검색 결과 컨테이너 대기
  await page.waitForSelector('#_pcmap_list_scroll_container', { timeout: 15_000 }).catch(() => {
    log.warning('검색 결과 컨테이너를 찾을 수 없음 — 셀렉터가 변경되었을 수 있습니다');
  });

  // 페이지네이션으로 여러 페이지 수집 (최대 5페이지)
  const allIds = new Set<string>();

  for (let pageNum = 0; pageNum < 5; pageNum++) {
    // 현재 페이지에서 스크롤하여 모든 결과 로딩
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const el = document.querySelector('#_pcmap_list_scroll_container');
        if (el) el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(1000);
    }

    // __APOLLO_STATE__ 및 script 태그에서 place ID 추출
    const pageIds = await page.evaluate(() => {
      const ids = new Set<string>();

      // 방법 1: __APOLLO_STATE__에서 추출
      const apollo = (window as any).__APOLLO_STATE__;
      if (apollo) {
        for (const key of Object.keys(apollo)) {
          const match = key.match(/Place:(\d{7,})/);
          if (match) ids.add(match[1]);
        }
      }

      // 방법 2: script 태그 내 JSON에서 추출
      for (const s of document.querySelectorAll('script')) {
        const text = s.textContent ?? '';
        for (const m of text.matchAll(/"id"\s*:\s*"?(\d{7,})"?/g)) {
          ids.add(m[1]);
        }
      }

      return [...ids];
    });

    for (const id of pageIds) allIds.add(id);
    log.info(`페이지 ${pageNum + 1}: ${pageIds.length}개 ID 발견 (누적 ${allIds.size}개)`);

    // 다음 페이지 버튼 클릭
    const nextBtn = await page.$('a:has-text("다음페이지"), button:has-text("다음페이지")');
    if (!nextBtn) break;
    await nextBtn.click();
    await page.waitForTimeout(2000);
  }

  const placeIds = [...allIds];

  log.info(`${placeIds.length}개 맛집 발견`);

  const requests = placeIds.map((id) => ({
    url: `https://pcmap.place.naver.com/restaurant/${id}/home`,
    label: 'DETAIL',
    userData: { placeId: id },
  }));

  await crawler.addRequests(requests);
}

/**
 * 맛집 상세 페이지 핸들러
 * 개별 맛집 페이지에서 상세 정보를 추출하여 RestaurantData로 반환
 */
export async function createDetailHandler(ctx: PlaywrightCrawlingContext): Promise<RestaurantData | null> {
  const { page, request, log } = ctx;
  const { placeId } = request.userData as { placeId: string };
  log.info(`상세 크롤링: ${placeId}`);

  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const getMeta = (prop: string) =>
      document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? '';

    // 이름: og:title에서 " : 네이버" 제거
    const name = getMeta('og:title').replace(/\s*:\s*네이버.*$/, '').trim();

    // 주소
    const addrEl = document.querySelector('[data-kakaotalk-description]');
    const address = addrEl?.getAttribute('data-kakaotalk-description')?.replace(/&amp;/g, '&').trim() ?? '';

    // 전화번호
    const phoneMatch = document.body.innerHTML.match(/0\d{1,3}-\d{3,4}-\d{4}/);
    const phone = phoneMatch?.[0] ?? '';

    // 카테고리
    const catMatch = document.body.innerHTML.match(/"category"\s*:\s*"([^"]{2,30})"/);
    const category = catMatch?.[1] ?? '';

    // 평점
    const ratingEl = document.querySelector('[class*="PXMot"] em, .LXIwF em');
    const rating = ratingEl ? parseFloat(ratingEl.textContent ?? '0') : undefined;

    // 리뷰 수
    const visitorMatch = document.body.innerHTML.match(/"visitorReviewCount"\s*:\s*(\d+)/);
    const visitorReviewCount = visitorMatch ? parseInt(visitorMatch[1]) : 0;
    const blogMatch = document.body.innerHTML.match(/"reviewCount"\s*:\s*(\d+)/);
    const reviewCount = blogMatch ? parseInt(blogMatch[1]) : 0;

    // 이미지
    const rawImage = getMeta('og:image');
    const imgSrc = rawImage.match(/[?&]src=([^&]+)/);
    const image_url = imgSrc ? decodeURIComponent(imgSrc[1]) : rawImage;

    // 좌표 (JSON 내 x/y 값)
    const latMatch = document.body.innerHTML.match(/"y"\s*:\s*"?([\d.]+)"?/);
    const lngMatch = document.body.innerHTML.match(/"x"\s*:\s*"?([\d.]+)"?/);
    const latitude = latMatch ? parseFloat(latMatch[1]) : undefined;
    const longitude = lngMatch ? parseFloat(lngMatch[1]) : undefined;

    // 메뉴 (최대 5개)
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

  if (!data.name) {
    log.warning(`이름 추출 실패: ${placeId}`);
    return null;
  }

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

/** 카테고리/이름 기반 태그 자동 추론 */
function inferTags(category: string, name: string): string[] {
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
    '해물': ['해물', '회'],
    '베이커리': ['베이커리', '빵'],
    '브런치': ['브런치'],
  };

  const tags = new Set<string>();
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some((kw) => text.includes(kw))) tags.add(tag);
  }
  return [...tags];
}
