/**
 * single.ts — 단일 업체 크롤링
 *
 * 사용법:
 *   tsx src/single.ts --query="마산 불낙명가"
 *   tsx src/single.ts --query="마산 불낙명가" --analyze-reviews
 *
 * 결과를 logs/single-result.json 에 저장
 */
import 'dotenv/config';
import { autoTagRestaurant } from './tagger.js';
import { type Page } from 'playwright';
import { stealthChromium, LAUNCH_ARGS, injectStealth, waitForApollo, waitForContent } from './stealth-browser.js';
import { upsertRestaurants, type RestaurantData, type ReviewKeyword, type MenuKeyword, type BlogReview } from './storage.js';
import { crawlDetailInfo } from './main.js';
import { processImage } from './image.js';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const RESULT_FILE = path.join(new URL('../logs/single-result.json', import.meta.url).pathname);
const LOGS_DIR = path.dirname(RESULT_FILE);

function writeResult(payload: {
  query: string;
  status: 'success' | 'failed' | 'not_found';
  store?: RestaurantData | null;
  error?: string;
  finishedAt: string;
}) {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(RESULT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    console.error('[single] 결과 파일 쓰기 실패:', (e as Error).message);
  }
}

// ── Apollo 캐시에서 첫 번째 결과만 추출 ──────────────────────
async function getFirstResult(page: Page, query: string): Promise<RestaurantData | null> {
  console.log(`🔍 네이버 플레이스 검색: "${query}"`);

  await page.goto(
    `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`,
    { waitUntil: 'networkidle', timeout: 25_000 },
  );
  await waitForApollo(page);

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
        naver_place_url: `https://map.naver.com/p/entry/place/${m[1]}`,
      });
    }
    return results;
  });

  console.log(`   검색 결과: ${items.length}개`);
  if (!items.length) return null;

  // 가장 첫 번째 (가장 관련성 높은) 결과 반환
  return items[0];
}

// ── 리뷰 상세 분석 ───────────────────────────────────────────
async function crawlReviews(page: Page, placeId: string): Promise<{
  keywords: ReviewKeyword[];
  menuKeywords: MenuKeyword[];
  summary: Record<string, number>;
  blogReviews: BlogReview[];
}> {
  // 방문자 리뷰
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/visitor`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await waitForContent(page);

  const visitorData = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    const keywords: Array<{ keyword: string; count: number }> = [];
    for (const m of body.matchAll(/"([^"]{4,20})"\s*이 키워드를 선택한 인원\s*(\d+)/g)) {
      keywords.push({ keyword: m[1], count: parseInt(m[2]) });
    }

    const menuKeywords: Array<{ menu: string; count: number }> = [];
    const summary: Record<string, number> = {};
    let section: 'none' | 'menu' | 'feature' = 'none';
    const skipWords = new Set(['이전', '다음', '리뷰', '안내', '사진', '영상', '더보기', '정렬']);

    for (const line of lines) {
      if (line === '메뉴') { section = 'menu'; continue; }
      if (line === '특징') { section = 'feature'; continue; }
      if (line === '추천순' || line === '최신순') { section = 'none'; continue; }

      const match = line.match(/^([가-힣\s]+)(\d+)$/);
      if (!match) continue;

      const name = match[1].trim();
      const count = parseInt(match[2]);
      if (!name || name.length > 10 || count < 1) continue;
      if (skipWords.has(name)) continue;

      if (section === 'menu') menuKeywords.push({ menu: name, count });
      else if (section === 'feature') summary[name] = count;
    }

    return { keywords, menuKeywords, summary };
  });

  // 블로그 리뷰
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/ugc`, {
    waitUntil: 'networkidle', timeout: 15_000,
  });
  await waitForContent(page);

  const blogReviews: BlogReview[] = await page.evaluate(() => {
    // ── 1. DOM에서 블로그 링크 선추출 ───────────────────────────
    const anchorLinks: { href: string; text: string }[] = [];
    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
      const href = a.href ?? '';
      if (!href.includes('blog.naver.com') && !href.includes('m.blog.naver.com') && !href.includes('post.naver.com')) return;
      const text = a.textContent?.trim() ?? '';
      anchorLinks.push({ href, text });
    });

    function findLink(title: string): string {
      if (!title || !anchorLinks.length) return '';
      const exact = anchorLinks.find(a => a.text === title);
      if (exact) return exact.href;
      // 제목이 앵커 텍스트를 포함하거나 그 반대
      const partial = anchorLinks.find(a =>
        a.text.length >= 10 && (title.includes(a.text) || a.text.includes(title.slice(0, 15))),
      );
      return partial?.href ?? '';
    }

    // ── 2. innerText 기반 제목·snippet·날짜 파싱 ────────────────
    const body = document.body.innerText;
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const reviews: Array<{ title: string; snippet: string; date: string; link: string }> = [];

    let started = false;
    let buffer: string[] = [];
    const skipPatterns = /^(리뷰|정렬|추천순|최신순|더보기|이전|피드형식|리스트형식|방문자|블로그)/;
    const dateShort = /^\d{2}\.\d{1,2}\.\d{1,2}\.[가-힣]$/;
    const dateLong = /^\d{4}년 \d{1,2}월 \d{1,2}일/;

    for (const line of lines) {
      if (line.includes('피드형식으로') || line.includes('리스트형식으로')) { started = true; continue; }
      if (!started) continue;

      if (dateShort.test(line)) {
        const title = buffer.find((l) => l.length >= 15 && l.length <= 80) ?? '';
        const snippet = buffer.find((l) => l.length > 80)?.slice(0, 300) ?? '';
        if (title || snippet) reviews.push({ title, snippet, date: line, link: findLink(title) });
        buffer = [];
        continue;
      }
      if (dateLong.test(line)) continue;
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

// ── 메인 ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const queryArg = args.find((a) => a.startsWith('--query='))?.split('=').slice(1).join('=');
const analyzeReviews = args.includes('--analyze-reviews');

if (!queryArg) {
  console.error('❌ --query="지역 가게이름" 인수가 필요합니다');
  process.exit(1);
}

const query = queryArg.trim();
console.log(`\n${'─'.repeat(50)}`);
console.log(`단일 업체 크롤링`);
console.log(`쿼리: "${query}"`);
console.log(`리뷰분석: ${analyzeReviews ? '✓' : '✗'}`);
console.log(`${'─'.repeat(50)}\n`);

const browser = await stealthChromium.launch(LAUNCH_ARGS as any);
try {
  const page = await browser.newPage();
  await injectStealth(page); // stealth 주입

  // 1. 검색
  const store = await getFirstResult(page, query);
  if (!store) {
    console.log('검색 결과 없음');
    writeResult({ query, status: 'not_found', store: null, finishedAt: new Date().toISOString() });
    await browser.close();
    process.exit(0);
  }

  console.log(`✓ 발견: ${store.name}`);
  console.log(`  카테고리: ${store.category}`);
  console.log(`  주소: ${store.address}`);
  console.log(`  전화: ${store.phone}`);
  console.log(`  URL: ${store.naver_place_url}`);

  store.tags = [query];

  // 2. 홈 탭 상세 정보 (영업시간·홈페이지·메뉴판) — 항상 수집
  console.log('\n📋 상세 정보 수집 중...');
  try {
    const detail = await crawlDetailInfo(page, store.naver_place_id!);
    if (detail.business_hours)        { store.business_hours = detail.business_hours; console.log(`  영업시간: ${detail.business_hours}`); }
    if (detail.business_hours_detail) store.business_hours_detail = detail.business_hours_detail;
    if (detail.website_url)           { store.website_url = detail.website_url; console.log(`  홈페이지: ${detail.website_url}`); }
    if (detail.instagram_url)         { store.instagram_url = detail.instagram_url; console.log(`  인스타: ${detail.instagram_url}`); }
    if (detail.menu_items?.length)    { store.menu_items = detail.menu_items; console.log(`  메뉴: ${detail.menu_items.length}개`); }
  } catch (e) {
    console.log(`  상세 정보 에러: ${(e as Error).message}`);
  }

  // 3. 리뷰 분석 (옵션)
  if (analyzeReviews) {
    console.log('\n리뷰 분석 중...');
    try {
      const reviews = await crawlReviews(page, store.naver_place_id!);
      store.review_keywords = reviews.keywords;
      store.menu_keywords = reviews.menuKeywords;
      store.review_summary = reviews.summary;
      store.blog_reviews = reviews.blogReviews;
      console.log(`  키워드 ${reviews.keywords.length}개, 메뉴 ${reviews.menuKeywords.length}개, 블로그리뷰 ${reviews.blogReviews.length}개`);
    } catch (e) {
      console.log(`  리뷰 에러: ${(e as Error).message}`);
    }
  }

  // 4. 이미지 처리
  if (store.image_url) {
    console.log('\n📷 이미지 처리 중...');
    try {
      const { url, isProcessed } = await processImage(store.image_url, store.naver_place_id!);
      store.image_url = url;
      console.log(`  ${isProcessed ? '✓ 최적화 완료' : '(기존 이미지 사용)'}`);
    } catch (e) {
      console.log(`  이미지 에러: ${(e as Error).message}`);
    }
  }

  // 4-b. 자동 태그 부여
  console.log('\n🏷️  태그 자동 분류 중...');
  store.auto_tags = autoTagRestaurant(store);
  const flatTags = Object.values(store.auto_tags).flat();
  console.log(`  ${flatTags.length}개 태그: ${flatTags.slice(0, 8).join(', ')}${flatTags.length > 8 ? ' ...' : ''}`);

  // 5. DB 저장
  console.log('\n💾 DB 저장 중...');
  const saved = await upsertRestaurants([store]);
  console.log(`  ${saved > 0 ? '✓ 저장 완료' : '(이미 존재 — 업데이트)'}`);

  // 6. 결과 파일 저장
  writeResult({
    query,
    status: 'success',
    store,
    finishedAt: new Date().toISOString(),
  });

  console.log(`\n✅ 완료: ${store.name}`);
} catch (e) {
  const msg = (e as Error).message;
  console.error(`\n❌ 에러: ${msg}`);
  writeResult({
    query,
    status: 'failed',
    error: msg,
    finishedAt: new Date().toISOString(),
  });
  await browser.close();
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}

// Supabase 연결이 이벤트 루프를 붙잡지 않도록 강제 종료
process.exit(0);
