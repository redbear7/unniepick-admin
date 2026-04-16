import 'dotenv/config';
import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 새로오픈 검색 → 첫 번째 맛집 ID 가져오기
  await page.goto('https://pcmap.place.naver.com/restaurant/list?query=%EC%B0%BD%EC%9B%90%EC%8B%9C+%EC%83%88%EB%A1%9C%EC%98%A4%ED%94%88+%EB%A7%9B%EC%A7%91', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(3000);

  const firstId = await page.evaluate(() => {
    const apollo = (window as any).__APOLLO_STATE__;
    if (!apollo) return null;
    for (const key of Object.keys(apollo)) {
      const m = key.match(/^Place:(\d{7,})$/);
      if (m) return m[1];
    }
    return null;
  });

  if (!firstId) {
    console.log('ID를 찾을 수 없음');
    await browser.close();
    return;
  }

  console.log(`\n상세 페이지: ${firstId}`);

  // 상세 페이지 접속
  await page.goto(`https://pcmap.place.naver.com/restaurant/${firstId}/home`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(3000);

  // 1. 키워드 리뷰 (방문자 키워드) 확인
  console.log('\n=== 키워드 리뷰 셀렉터 탐색 ===');
  const keywordSelectors = [
    '[class*="keyword"]', '[class*="chip"]', '[class*="tag"]',
    '[class*="review_filter"]', '[class*="visitor"]',
    '[class*="RKvNR"]', '[class*="xHaT3"]',
  ];
  for (const sel of keywordSelectors) {
    const items = await page.$$eval(sel, (els) =>
      els.slice(0, 5).map((el) => ({
        tag: el.tagName,
        class: el.className.slice(0, 60),
        text: el.textContent?.slice(0, 80)?.trim(),
      }))
    ).catch(() => []);
    if (items.length) console.log(`  ${sel}:`, JSON.stringify(items));
  }

  // 2. body에서 키워드 패턴 찾기
  const keywordData = await page.evaluate(() => {
    const html = document.body.innerHTML;

    // Apollo에서 키워드 리뷰 데이터 찾기
    const apollo = (window as any).__APOLLO_STATE__;
    const keywords: any[] = [];
    if (apollo) {
      for (const [key, value] of Object.entries(apollo) as [string, any][]) {
        if (key.includes('Keyword') || key.includes('keyword') || key.includes('Tag')) {
          keywords.push({ key: key.slice(0, 50), value: JSON.stringify(value).slice(0, 200) });
        }
      }
      // visitorReview 관련 데이터
      for (const [key, value] of Object.entries(apollo) as [string, any][]) {
        if (key.includes('Review') || key.includes('review')) {
          keywords.push({ key: key.slice(0, 50), value: JSON.stringify(value).slice(0, 200) });
        }
      }
    }

    // HTML에서 키워드 리뷰 패턴
    const kwMatches = html.match(/"keywords?\s*"\s*:\s*\[([^\]]{10,500})\]/);
    const visitorKw = html.match(/"visitorReviewKeyword[^"]*"\s*:\s*"([^"]+)"/g);

    return {
      apolloKeywords: keywords.slice(0, 10),
      htmlKeywordMatch: kwMatches?.[0]?.slice(0, 300) ?? 'not found',
      visitorKeywords: visitorKw?.slice(0, 10) ?? [],
    };
  });
  console.log('\n=== 키워드 데이터 ===');
  console.log(JSON.stringify(keywordData, null, 2));

  // 3. 리뷰 탭으로 이동
  console.log('\n=== 리뷰 페이지 ===');
  await page.goto(`https://pcmap.place.naver.com/restaurant/${firstId}/review/visitor`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(3000);

  // 키워드 태그들 추출
  const reviewKeywords = await page.evaluate(() => {
    // 키워드 필터 버튼들
    const chips: string[] = [];
    document.querySelectorAll('[class*="chip"], [class*="keyword"], [class*="filter"] span, [class*="tag"]').forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.length > 1 && t.length < 30) chips.push(t);
    });

    // 리뷰 텍스트 (처음 5개)
    const reviews: string[] = [];
    document.querySelectorAll('[class*="review_content"], [class*="text_comment"], [class*="ZZ4OK"]').forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.length > 10) reviews.push(t.slice(0, 200));
    });

    return { chips: [...new Set(chips)].slice(0, 20), reviews: reviews.slice(0, 5) };
  });
  console.log('키워드 칩:', reviewKeywords.chips);
  console.log('리뷰 샘플:', reviewKeywords.reviews);

  // 4. 블로그 리뷰
  console.log('\n=== 블로그 리뷰 ===');
  await page.goto(`https://pcmap.place.naver.com/restaurant/${firstId}/review/ugc`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(3000);

  const blogReviews = await page.evaluate(() => {
    const items: Array<{ title: string; snippet: string }> = [];
    document.querySelectorAll('[class*="review_item"], [class*="blog_item"], article, [class*="RHxMn"]').forEach((el) => {
      const title = el.querySelector('a, h3, h4, [class*="title"]')?.textContent?.trim() ?? '';
      const snippet = el.querySelector('p, [class*="text"], [class*="desc"]')?.textContent?.trim() ?? '';
      if (title || snippet) items.push({ title: title.slice(0, 80), snippet: snippet.slice(0, 150) });
    });
    return items.slice(0, 5);
  });
  console.log('블로그 리뷰:', JSON.stringify(blogReviews, null, 2));

  await page.waitForTimeout(5000);
  await browser.close();
}

debug().catch(console.error);
