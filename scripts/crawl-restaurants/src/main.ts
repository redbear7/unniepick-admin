import 'dotenv/config';
import { chromium } from 'playwright';
import cron from 'node-cron';
import {
  upsertRestaurants, getStats, getExistingIds,
  type RestaurantData, type ReviewKeyword, type MenuKeyword, type BlogReview,
} from './storage.js';

// ── 검색어 설정 ──────────────────────────────────────────────

const DAILY_QUERIES = ['창원시 새로오픈 맛집'];

const DISTRICT_QUERIES = [
  '상남동', '중앙동', '용호동', '팔용동',
  '명곡동', '사파동', '봉곡동', '대방동',
  '산호동', '합성동', '석전동', '반림동',
  '교방동', '자은동', '두대동', '북면',
  '마산합포구', '오동동', '창동', '양덕동',
  '진해구', '충무동', '여좌동', '풍호동',
];

const TEST_QUERIES = ['상남동'];

// ── 메인 크롤링 ─────────────────────────────────────────────

async function crawl(queries: string[], mode: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${new Date().toLocaleString('ko-KR')}] 크롤링 시작 (${mode})`);
  console.log(`${'='.repeat(50)}`);

  const isDaily = mode === 'daily';

  // 신규 감지용: 기존 DB의 place ID 목록
  const existingIds = await getExistingIds();
  console.log(`기존 DB: ${existingIds.size}개`);

  const browser = await chromium.launch({ headless: true, args: ['--lang=ko-KR'] });
  const allResults: RestaurantData[] = [];

  try {
    for (const q of queries) {
      const query = isDaily ? q : `창원시 ${q} 맛집`;
      console.log(`\n  🔍 "${query}"`);

      const page = await browser.newPage();
      try {
        // 1~5페이지 place ID 수집
        const placeIds = await collectPlaceIds(page, query);
        console.log(`     ${placeIds.length}개 ID 수집`);

        for (const id of placeIds) {
          try {
            // 기본 정보 크롤링
            const data = await crawlDetail(page, id);
            if (!data) continue;

            // 새로오픈 모드: 키워드 리뷰 + 블로그 리뷰 상세 분석
            if (isDaily) {
              data.is_new_open = true;
              const reviews = await crawlReviews(page, id);
              data.review_keywords = reviews.keywords;
              data.menu_keywords = reviews.menuKeywords;
              data.review_summary = reviews.summary;
              data.blog_reviews = reviews.blogReviews;
            }

            if (!isDaily) data.tags = [...(data.tags ?? []), q];
            allResults.push(data);
          } catch { /* 개별 실패 무시 */ }
          await page.waitForTimeout(isDaily ? 800 : 400);
        }

        console.log(`     ✓ 완료 (누적 ${allResults.length}개)`);
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
      existing.tags = [...new Set([...(existing.tags ?? []), ...(r.tags ?? [])])];
    } else {
      unique.set(r.naver_place_id, r);
    }
  }
  const deduped = [...unique.values()];
  console.log(`\n중복 제거: ${allResults.length} → ${deduped.length}개`);

  // ── 신규 업체 감지 ──
  const newRestaurants = deduped.filter((r) => !existingIds.has(r.naver_place_id));
  if (newRestaurants.length > 0) {
    console.log(`\n${'🆕'.repeat(20)}`);
    console.log(`🆕 신규 업체 ${newRestaurants.length}개 발견!`);
    console.log(`${'🆕'.repeat(20)}`);
    for (const r of newRestaurants) {
      console.log(`  📍 ${r.name} (${r.category ?? '기타'}) ★${r.rating ?? '?'} 리뷰${r.visitor_review_count ?? 0}건`);
      console.log(`     ${r.address ?? ''}`);
      if (r.review_keywords?.length) {
        console.log(`     키워드: ${r.review_keywords.slice(0, 3).map((k) => `${k.keyword}(${k.count})`).join(', ')}`);
      }
      if (r.naver_place_url) {
        console.log(`     ${r.naver_place_url}`);
      }
      console.log('');
    }
  } else if (existingIds.size > 0) {
    console.log('\n✅ 신규 업체 없음 (변동 없음)');
  }

  // DB 저장
  if (deduped.length > 0) {
    const saved = await upsertRestaurants(deduped);
    console.log(`\n💾 ${saved}개 DB 저장`);
  }

  const stats = await getStats();
  console.log(`📊 DB 총: ${stats.total}개\n`);

  return { newRestaurants, total: deduped.length };
}

// ── ID 수집 (1~5 페이지) ────────────────────────────────────

async function collectPlaceIds(page: any, query: string): Promise<string[]> {
  const allIds = new Set<string>();

  await page.goto(
    `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`,
    { waitUntil: 'networkidle', timeout: 20_000 },
  );
  await page.waitForTimeout(2500);

  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    const ids: string[] = await page.evaluate(() => {
      const found = new Set<string>();
      // script 태그 내 ID (가장 안정적)
      for (const s of document.querySelectorAll('script')) {
        const text = s.textContent ?? '';
        for (const m of text.matchAll(/"id"\s*:\s*"(\d{7,})"/g)) found.add(m[1]);
      }
      return [...found];
    });

    const prevSize = allIds.size;
    for (const id of ids) allIds.add(id);
    console.log(`     페이지 ${pageNum}: +${allIds.size - prevSize}개 (누적 ${allIds.size}개)`);

    if (pageNum < 5) {
      const nextBtn = await page.$('a:has-text("다음페이지"), button:has-text("다음페이지")');
      if (!nextBtn) { console.log(`     (마지막 페이지)`); break; }
      await nextBtn.click();
      await page.waitForTimeout(2500);
    }
  }

  return [...allIds];
}

// ── 상세 페이지 기본 정보 ───────────────────────────────────

async function crawlDetail(page: any, placeId: string): Promise<RestaurantData | null> {
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/home`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const getMeta = (prop: string) =>
      document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? '';

    const name = getMeta('og:title').replace(/\s*:\s*네이버.*$/, '').trim();
    const addrEl = document.querySelector('[data-kakaotalk-description]');
    const address = addrEl?.getAttribute('data-kakaotalk-description')?.replace(/&amp;/g, '&').trim() ?? '';
    const phoneMatch = document.body.innerHTML.match(/0\d{1,3}-\d{3,4}-\d{4}/);
    const catMatch = document.body.innerHTML.match(/"category"\s*:\s*"([^"]{2,30})"/);
    const ratingEl = document.querySelector('[class*="PXMot"] em, .LXIwF em');
    const visitorMatch = document.body.innerHTML.match(/"visitorReviewCount"\s*:\s*(\d+)/);
    const blogMatch = document.body.innerHTML.match(/"reviewCount"\s*:\s*(\d+)/);
    const rawImage = getMeta('og:image');
    const imgSrc = rawImage.match(/[?&]src=([^&]+)/);
    const latMatch = document.body.innerHTML.match(/"y"\s*:\s*"?([\d.]+)"?/);
    const lngMatch = document.body.innerHTML.match(/"x"\s*:\s*"?([\d.]+)"?/);

    const menuItems: Array<{ name: string; price?: string }> = [];
    document.querySelectorAll('[class*="menu_item"], [class*="item_info"]').forEach((el) => {
      const n = el.querySelector('[class*="name"]')?.textContent?.trim();
      const p = el.querySelector('[class*="price"]')?.textContent?.trim();
      if (n) menuItems.push({ name: n, price: p ?? undefined });
    });

    return {
      name, address,
      phone: phoneMatch?.[0] ?? '',
      category: catMatch?.[1] ?? '',
      rating: ratingEl ? parseFloat(ratingEl.textContent ?? '0') : undefined,
      visitorReviewCount: visitorMatch ? parseInt(visitorMatch[1]) : 0,
      reviewCount: blogMatch ? parseInt(blogMatch[1]) : 0,
      image_url: imgSrc ? decodeURIComponent(imgSrc[1]) : rawImage,
      latitude: latMatch ? parseFloat(latMatch[1]) : undefined,
      longitude: lngMatch ? parseFloat(lngMatch[1]) : undefined,
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

// ── 리뷰 상세 분석 (새로오픈 전용) ─────────────────────────

async function crawlReviews(page: any, placeId: string): Promise<{
  keywords: ReviewKeyword[];
  menuKeywords: MenuKeyword[];
  summary: Record<string, number>;
  blogReviews: BlogReview[];
}> {
  // ── 방문자 리뷰 페이지 ──
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/visitor`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await page.waitForTimeout(2000);

  const visitorData = await page.evaluate(() => {
    const body = document.body.innerText;

    // 키워드 리뷰: "음식이 맛있어요" ... 229 패턴
    const keywords: Array<{ keyword: string; count: number }> = [];
    const kwMatches = body.matchAll(/"([^"]+)"\s*이 키워드를 선택한 인원\s*(\d+)/g);
    for (const m of kwMatches) {
      keywords.push({ keyword: m[1], count: parseInt(m[2]) });
    }

    // 메뉴 키워드: "오징어38" 형태 (메뉴 + 숫자가 붙어있음)
    // body에서 "메뉴" 이후 ~ "특징" 이전 구간 추출
    const menuSection = body.match(/메뉴\n([\s\S]*?)\n특징/);
    const menuKeywords: Array<{ menu: string; count: number }> = [];
    if (menuSection) {
      const menuMatches = menuSection[1].matchAll(/([가-힣]+(?:\s?[가-힣]+)?)(\d+)/g);
      for (const m of menuMatches) {
        menuKeywords.push({ menu: m[1].trim(), count: parseInt(m[2]) });
      }
    }

    // 특징 요약: "맛169 만족도135 서비스34" 형태
    const featureSection = body.match(/특징\n([\s\S]*?)\n(?:추천순|최신순)/);
    const summary: Record<string, number> = {};
    if (featureSection) {
      const featMatches = featureSection[1].matchAll(/([가-힣]+)(\d+)/g);
      for (const m of featMatches) {
        summary[m[1]] = parseInt(m[2]);
      }
    }

    return { keywords, menuKeywords, summary };
  });

  // ── 블로그 리뷰 페이지 ──
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/ugc`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await page.waitForTimeout(2000);

  const blogReviews: BlogReview[] = await page.evaluate(() => {
    const body = document.body.innerText;
    const reviews: Array<{ title: string; snippet: string; date?: string }> = [];

    // 블로그 리뷰 패턴: 닉네임 → 블로그명 → (다음) → 제목 → 본문... → 날짜
    // 제목은 보통 긴 텍스트 줄, 그 다음이 본문
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    let i = 0;
    while (i < lines.length) {
      // "피드형식으로 보기" 이후부터 블로그 리뷰 시작
      if (lines[i].includes('피드형식으로') || lines[i].includes('리스트형식으로')) {
        i++;
        continue;
      }

      // 날짜 패턴으로 리뷰 경계 감지 (26.4.16.목 또는 2026년 4월 16일)
      const dateMatch = lines[i].match(/(\d{2}\.\d{1,2}\.\d{1,2}\.[가-힣])/);
      if (dateMatch && reviews.length > 0) {
        reviews[reviews.length - 1].date = lines[i];
        i++;
        continue;
      }

      // 30자 이상이면 제목 또는 본문 후보
      if (lines[i].length >= 15 && !lines[i].includes('리뷰') && !lines[i].includes('정렬')) {
        // 이전에 제목이 없는 리뷰가 있으면 본문으로 추가
        if (reviews.length > 0 && !reviews[reviews.length - 1].snippet) {
          reviews[reviews.length - 1].snippet = lines[i].slice(0, 300);
        } else if (lines[i].length >= 15 && lines[i].length <= 80) {
          // 제목 후보
          reviews.push({ title: lines[i], snippet: '' });
        } else if (lines[i].length > 80) {
          // 본문 (제목 없이)
          if (reviews.length > 0 && !reviews[reviews.length - 1].snippet) {
            reviews[reviews.length - 1].snippet = lines[i].slice(0, 300);
          }
        }
      }

      i++;
    }

    return reviews.filter((r) => r.title || r.snippet).slice(0, 5);
  });

  return {
    keywords: visitorData.keywords,
    menuKeywords: visitorData.menuKeywords,
    summary: visitorData.summary,
    blogReviews,
  };
}

// ── 태그 추론 ───────────────────────────────────────────────

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
  crawl(TEST_QUERIES, 'district').catch(console.error);
} else if (mode === 'district') {
  crawl(DISTRICT_QUERIES, 'district').catch(console.error);
} else if (mode === 'daily') {
  crawl(DAILY_QUERIES, 'daily').catch(console.error);
} else {
  console.log('스케줄러 시작');
  console.log('  - 매일 06:00: 새로오픈 맛집 (상세 리뷰 분석)');
  console.log('  - 매주 월 03:00: 전체 동별 크롤링');
  crawl(DAILY_QUERIES, 'daily').catch(console.error);
  cron.schedule('0 6 * * *', () => crawl(DAILY_QUERIES, 'daily').catch(console.error));
  cron.schedule('0 3 * * 1', () => crawl(DISTRICT_QUERIES, 'district').catch(console.error));
}
