import 'dotenv/config';
import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://pcmap.place.naver.com/restaurant/list?query=%EC%B0%BD%EC%9B%90%EC%8B%9C+%EC%83%88%EB%A1%9C%EC%98%A4%ED%94%88+%EB%A7%9B%EC%A7%91', {
    waitUntil: 'networkidle', timeout: 20_000,
  });
  await page.waitForTimeout(3000);

  // 1. 보이는 맛집 이름 (TYaxT)
  const visibleNames = await page.$$eval('[class*="TYaxT"]', (els) =>
    els.map((el) => el.textContent?.trim() ?? '')
  );
  console.log(`\n보이는 맛집 (${visibleNames.length}개):`, visibleNames);

  // 2. Apollo에서 RestaurantListSummary 분석
  const apolloData = await page.evaluate(() => {
    const apollo = (window as any).__APOLLO_STATE__;
    if (!apollo) return { entries: [], sample: null };

    const entries: Array<{ key: string; id: string; name: string }> = [];
    for (const [key, value] of Object.entries(apollo) as [string, any][]) {
      const m = key.match(/^RestaurantListSummary:(\d+)/);
      if (m) {
        entries.push({
          key: key.slice(0, 60),
          id: m[1],
          name: value?.name ?? value?.display?.name ?? '',
        });
      }
    }

    // 첫 번째 RestaurantListSummary의 전체 구조
    const firstKey = Object.keys(apollo).find((k) => k.startsWith('RestaurantListSummary:'));
    const sample = firstKey ? apollo[firstKey] : null;

    return { entries: entries.slice(0, 30), sample };
  });

  console.log(`\nRestaurantListSummary 수: ${apolloData.entries.length}`);
  console.log('엔트리들:', JSON.stringify(apolloData.entries.slice(0, 10), null, 2));
  console.log('\n첫 엔트리 전체 구조:', JSON.stringify(apolloData.sample, null, 2)?.slice(0, 1000));

  // 3. 상세 페이지 접속 테스트 (첫 번째 ID)
  if (apolloData.entries.length > 0) {
    const testId = apolloData.entries[0].id;
    console.log(`\n=== 상세 페이지 테스트: ${testId} ===`);
    await page.goto(`https://pcmap.place.naver.com/restaurant/${testId}/home`, {
      waitUntil: 'networkidle', timeout: 15_000,
    });
    await page.waitForTimeout(2000);

    const detailUrl = page.url();
    console.log('URL:', detailUrl);

    const title = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:title"]');
      return meta?.getAttribute('content') ?? 'NOT FOUND';
    });
    console.log('og:title:', title);

    const bodyStart = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log('body:', bodyStart);
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

debug().catch(console.error);
