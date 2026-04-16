import 'dotenv/config';
import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 이미 확인된 ID로 바로 상세+리뷰 페이지 분석
  const placeId = '2013464939'; // 속초오징어어시장 산호점

  // ── 1. 방문자 리뷰 페이지 ──
  console.log('\n=== 방문자 리뷰 페이지 ===');
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/visitor`, {
    waitUntil: 'networkidle', timeout: 20_000,
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'debug-visitor-review.png', fullPage: true });

  const visitorData = await page.evaluate(() => {
    const body = document.body.innerText;

    // 키워드 칩 — 다양한 셀렉터 시도
    const chipTexts: string[] = [];
    document.querySelectorAll('span, button, a, div').forEach((el) => {
      const cls = el.className ?? '';
      if (cls.includes('chip') || cls.includes('filter') || cls.includes('keyword') || cls.includes('FvwMK')) {
        const t = el.textContent?.trim();
        if (t && t.length > 1 && t.length < 30 && !t.includes('\n')) chipTexts.push(t);
      }
    });

    // 리뷰 텍스트
    const reviews: string[] = [];
    document.querySelectorAll('div, p, span').forEach((el) => {
      const cls = el.className ?? '';
      if (cls.includes('ZZ4OK') || cls.includes('text_comment') || cls.includes('review_content') || cls.includes('pui__') || cls.includes('WoYOw')) {
        const t = el.textContent?.trim();
        if (t && t.length > 20) reviews.push(t.slice(0, 200));
      }
    });

    // body 앞부분에서 키워드 패턴 찾기 ("맛있어요 30" 같은)
    const kwPattern = body.match(/([가-힣]+(?:해요|있어요|좋아요|져요|이에요|네요|달라요))\s*(\d+)/g);

    return {
      chipTexts: [...new Set(chipTexts)].slice(0, 20),
      reviews: [...new Set(reviews)].slice(0, 5),
      kwPattern: kwPattern?.slice(0, 15) ?? [],
      bodyPreview: body.slice(0, 2000),
    };
  });

  console.log('키워드 칩:', visitorData.chipTexts);
  console.log('키워드 패턴:', visitorData.kwPattern);
  console.log('리뷰 샘플:', visitorData.reviews.slice(0, 3));
  console.log('\nbody 앞 2000자:\n', visitorData.bodyPreview);

  // ── 2. 블로그 리뷰 페이지 ──
  console.log('\n\n=== 블로그 리뷰 페이지 ===');
  await page.goto(`https://pcmap.place.naver.com/restaurant/${placeId}/review/ugc`, {
    waitUntil: 'networkidle', timeout: 20_000,
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'debug-blog-review.png', fullPage: true });

  const blogData = await page.evaluate(() => {
    const body = document.body.innerText;
    return { bodyPreview: body.slice(0, 2000) };
  });
  console.log('블로그 body 앞 2000자:\n', blogData.bodyPreview);

  await page.waitForTimeout(5000);
  await browser.close();
}

debug().catch(console.error);
