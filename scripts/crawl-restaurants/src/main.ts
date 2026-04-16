import 'dotenv/config';
import { chromium, type Page } from 'playwright';
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
        // ── 1. 목록에서 기본 정보 일괄 추출 (Apollo 캐시) ──
        const restaurants = await collectFromApollo(page, query);
        console.log(`     ${restaurants.length}개 업체 수집`);

        // ── 2. 새로오픈 모드: 업체별 상세 리뷰 분석 ──
        if (isDaily) {
          for (let i = 0; i < restaurants.length; i++) {
            const r = restaurants[i];
            r.is_new_open = true;
            try {
              console.log(`     [${i + 1}/${restaurants.length}] ${r.name} 리뷰 분석...`);
              const reviews = await crawlReviews(page, r.naver_place_id);
              r.review_keywords = reviews.keywords;
              r.menu_keywords = reviews.menuKeywords;
              r.review_summary = reviews.summary;
              r.blog_reviews = reviews.blogReviews;
            } catch (e) {
              console.log(`       리뷰 에러: ${(e as Error).message}`);
            }
            await page.waitForTimeout(500 + Math.random() * 500);
          }
        }

        if (!isDaily) {
          for (const r of restaurants) r.tags = [...(r.tags ?? []), q];
        }

        allResults.push(...restaurants);
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
  if (newRestaurants.length > 0 && existingIds.size > 0) {
    console.log(`\n${'🆕'.repeat(20)}`);
    console.log(`🆕 신규 업체 ${newRestaurants.length}개 발견!`);
    console.log(`${'🆕'.repeat(20)}`);
    for (const r of newRestaurants) {
      console.log(`  📍 ${r.name} (${r.category ?? '기타'}) ★${r.rating ?? '?'} 리뷰${r.visitor_review_count ?? 0}건`);
      console.log(`     ${r.address ?? ''}`);
      if (r.review_keywords?.length) {
        console.log(`     키워드: ${r.review_keywords.slice(0, 3).map((k) => `${k.keyword}(${k.count})`).join(', ')}`);
      }
      console.log(`     ${r.naver_place_url ?? ''}\n`);
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

// ── Apollo 캐시에서 목록 기본 정보 일괄 추출 ────────────────

async function collectFromApollo(page: Page, query: string): Promise<RestaurantData[]> {
  const allResults: RestaurantData[] = [];
  const seenIds = new Set<string>();

  await page.goto(
    `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`,
    { waitUntil: 'networkidle', timeout: 20_000 },
  );
  await page.waitForTimeout(2500);

  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    // Apollo RestaurantListSummary에서 기본 정보 추출
    const items: RestaurantData[] = await page.evaluate(() => {
      const apollo = (window as any).__APOLLO_STATE__;
      if (!apollo) return [];

      const results: any[] = [];
      for (const [key, val] of Object.entries(apollo) as [string, any][]) {
        const m = key.match(/^RestaurantListSummary:(\d+):/);
        if (!m) continue;

        results.push({
          naver_place_id: m[1],
          name: val.name ?? '',
          address: val.roadAddress
            ? `${val.commonAddress ?? ''} ${val.roadAddress}`.trim()
            : val.address ?? '',
          phone: val.virtualPhone ?? val.phone ?? '',
          category: val.category ?? '',
          latitude: val.y ? parseFloat(val.y) : undefined,
          longitude: val.x ? parseFloat(val.x) : undefined,
          image_url: val.imageUrl ?? '',
          visitor_review_count: parseInt(val.visitorReviewCount ?? '0') || 0,
          review_count: parseInt(val.blogCafeReviewCount ?? val.totalReviewCount ?? '0') || 0,
          naver_place_url: `https://map.naver.com/p/entry/place/${m[1]}`,
        });
      }
      return results;
    });

    // 새 ID만 추가
    let newCount = 0;
    for (const item of items) {
      if (seenIds.has(item.naver_place_id)) continue;
      seenIds.add(item.naver_place_id);
      item.tags = inferTags(item.category ?? '', item.name);
      allResults.push(item);
      newCount++;
    }

    console.log(`     페이지 ${pageNum}: ${newCount}개 (누적 ${allResults.length}개)`);

    if (newCount === 0 && pageNum > 1) {
      console.log(`     (새 결과 없음 — 종료)`);
      break;
    }

    // 다음 페이지
    if (pageNum < 5) {
      const nextBtn = await page.$('a:has-text("다음페이지"), button:has-text("다음페이지")');
      if (!nextBtn) { console.log(`     (마지막 페이지)`); break; }

      const prevFirstName = await page.$eval(
        '[class*="TYaxT"]', (el: Element) => el.textContent?.trim() ?? '',
      ).catch(() => '');

      await nextBtn.click();

      // 페이지 변경 대기
      for (let w = 0; w < 10; w++) {
        await page.waitForTimeout(500);
        const newFirstName = await page.$eval(
          '[class*="TYaxT"]', (el: Element) => el.textContent?.trim() ?? '',
        ).catch(() => '');
        if (newFirstName && newFirstName !== prevFirstName) break;
      }
      await page.waitForTimeout(1000);
    }
  }

  return allResults;
}

// ── 리뷰 상세 분석 (새로오픈 전용) ─────────────────────────

async function crawlReviews(page: Page, placeId: string): Promise<{
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

    // 메뉴 키워드: "메뉴\n오징어38\n..." → "특징" 사이
    const menuSection = body.match(/메뉴\n([\s\S]*?)\n특징/);
    const menuKeywords: Array<{ menu: string; count: number }> = [];
    if (menuSection) {
      for (const m of menuSection[1].matchAll(/([가-힣]+(?:\s?[가-힣]+)?)(\d+)/g)) {
        menuKeywords.push({ menu: m[1].trim(), count: parseInt(m[2]) });
      }
    }

    // 특징 요약: "맛169\n만족도135\n..."
    const featureSection = body.match(/특징\n([\s\S]*?)\n(?:추천순|최신순)/);
    const summary: Record<string, number> = {};
    if (featureSection) {
      for (const m of featureSection[1].matchAll(/([가-힣]+)(\d+)/g)) {
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
    const reviews: BlogReview[] = [];
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    // 블로그 리뷰 영역 찾기 (피드형식/리스트형식 이후)
    let started = false;
    let currentTitle = '';
    let currentSnippet = '';
    let currentDate = '';

    for (const line of lines) {
      if (line.includes('피드형식으로') || line.includes('리스트형식으로')) {
        started = true;
        continue;
      }
      if (!started) continue;

      // 날짜 패턴
      const dateMatch = line.match(/^\d{2}\.\d{1,2}\.\d{1,2}\.[가-힣]$/);
      const fullDateMatch = line.match(/^\d{4}년 \d{1,2}월 \d{1,2}일/);

      if (dateMatch || fullDateMatch) {
        // 이전 리뷰 저장
        if (currentTitle || currentSnippet) {
          reviews.push({ title: currentTitle, snippet: currentSnippet.slice(0, 300), date: line });
          currentTitle = '';
          currentSnippet = '';
        }
        continue;
      }

      // 15~80자 = 제목 후보
      if (line.length >= 10 && line.length <= 80 && !currentTitle
          && !line.includes('리뷰') && !line.includes('정렬') && !line.includes('더보기')
          && !line.includes('다음') && !line.includes('이전')) {
        currentTitle = line;
      }
      // 80자 이상 = 본문
      else if (line.length > 80 && !currentSnippet) {
        currentSnippet = line;
      }
    }
    // 마지막 리뷰
    if (currentTitle || currentSnippet) {
      reviews.push({ title: currentTitle, snippet: currentSnippet.slice(0, 300), date: currentDate });
    }

    return reviews.slice(0, 5);
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
