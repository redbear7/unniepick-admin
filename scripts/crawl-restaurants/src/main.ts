import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import cron from 'node-cron';
import {
  upsertRestaurants, getStats, getExistingIds,
  type RestaurantData, type ReviewKeyword, type MenuKeyword, type BlogReview,
} from './storage.js';
import { notifyNewRestaurants, notifyDailySummary } from './notify.js';
import { processImage } from './image.js';

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

        // ── 이미지 리사이즈 + Storage 업로드 ──
        console.log(`     📷 이미지 처리 중...`);
        let imgCount = 0;
        for (const r of restaurants) {
          if (r.image_url) {
            (r as any).image_url_original = r.image_url;
            const { url, isProcessed } = await processImage(r.image_url, r.naver_place_id);
            if (isProcessed) {
              r.image_url = url;
              imgCount++;
            }
          }
        }
        console.log(`     📷 ${imgCount}/${restaurants.length}개 이미지 저장`);

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

  // ── 텔레그램 알림 ──
  if (newRestaurants.length > 0 && existingIds.size > 0) {
    await notifyNewRestaurants(newRestaurants);
  }
  await notifyDailySummary(deduped.length, existingIds.size > 0 ? newRestaurants.length : 0);

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
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    // 키워드 리뷰: "음식이 맛있어요" ... 229 패턴
    const keywords: Array<{ keyword: string; count: number }> = [];
    for (const m of body.matchAll(/"([^"]{4,20})"\s*이 키워드를 선택한 인원\s*(\d+)/g)) {
      keywords.push({ keyword: m[1], count: parseInt(m[2]) });
    }

    // 메뉴/특징 구간을 줄 단위로 정확히 파싱
    // body 예: ...메뉴\n오징어38\n튀김23\n...\n특징\n맛169\n만족도135\n...\n추천순...
    const menuKeywords: Array<{ menu: string; count: number }> = [];
    const summary: Record<string, number> = {};

    let section: 'none' | 'menu' | 'feature' = 'none';
    const skipWords = new Set(['이전', '다음', '리뷰', '안내', '사진', '영상', '더보기', '정렬']);

    for (const line of lines) {
      // 구간 전환 감지
      if (line === '메뉴') { section = 'menu'; continue; }
      if (line === '특징') { section = 'feature'; continue; }
      if (line === '추천순' || line === '최신순') { section = 'none'; continue; }

      // "한글+숫자" 패턴만 추출 (예: "오징어38", "맛169")
      const match = line.match(/^([가-힣\s]+)(\d+)$/);
      if (!match) continue;

      const name = match[1].trim();
      const count = parseInt(match[2]);
      if (!name || name.length > 10 || count < 1) continue;
      if (skipWords.has(name)) continue;

      if (section === 'menu') {
        menuKeywords.push({ menu: name, count });
      } else if (section === 'feature') {
        summary[name] = count;
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
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const reviews: Array<{ title: string; snippet: string; date: string }> = [];

    // 블로그 리뷰 구조:
    // [닉네임] [블로그명] [다음] [제목] [본문...] [yy.mm.dd.요일] [yyyy년 mm월 dd일 ...]
    // 날짜 패턴으로 리뷰 경계를 나누고, 직전 긴 텍스트들에서 제목/본문 추출

    let started = false;
    let buffer: string[] = [];
    const skipPatterns = /^(리뷰|정렬|추천순|최신순|더보기|이전|피드형식|리스트형식|방문자|블로그)/;
    const dateShort = /^\d{2}\.\d{1,2}\.\d{1,2}\.[가-힣]$/;       // 26.4.16.목
    const dateLong = /^\d{4}년 \d{1,2}월 \d{1,2}일/;              // 2026년 4월 16일

    for (const line of lines) {
      if (line.includes('피드형식으로') || line.includes('리스트형식으로')) {
        started = true;
        continue;
      }
      if (!started) continue;

      // 짧은 날짜 = 리뷰 경계 (긴 날짜는 직후에 오므로 스킵)
      if (dateShort.test(line)) {
        // buffer에서 제목(20~80자)과 본문(80자+) 추출
        const title = buffer.find((l) => l.length >= 15 && l.length <= 80) ?? '';
        const snippet = buffer.find((l) => l.length > 80)?.slice(0, 300) ?? '';

        if (title || snippet) {
          reviews.push({ title, snippet, date: line });
        }
        buffer = [];
        continue;
      }
      if (dateLong.test(line)) continue; // 긴 날짜는 스킵

      // 필터링
      if (line.length < 5 || skipPatterns.test(line)) continue;
      if (line === '다음' || line === '이전' || line === '안내') continue;

      buffer.push(line);
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
  // 하루 1회만 실행 (부팅/잠자기 해제 시 체크)
  const lockFile = new URL('../.last-crawl', import.meta.url).pathname;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let lastRun = '';
  try { lastRun = (await import('fs')).readFileSync(lockFile, 'utf-8').trim(); } catch {}

  if (lastRun === today) {
    console.log(`[${today}] 오늘 이미 크롤링 완료. 건너뜀.`);
    process.exit(0);
  }

  const delayMin = Math.floor(Math.random() * 20) + 3; // 3~23분 랜덤
  console.log(`[${today}] ${delayMin}분 후 크롤링 시작 (봇 감지 회피)`);

  setTimeout(async () => {
    await crawl(DAILY_QUERIES, 'daily').catch(console.error);
    // 실행 완료 기록
    (await import('fs')).writeFileSync(lockFile, today);
    console.log('크롤링 완료. 프로세스 종료.');
    process.exit(0);
  }, delayMin * 60 * 1000);
}
