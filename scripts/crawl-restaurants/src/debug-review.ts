import 'dotenv/config';
import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 새로오픈 검색
  const url = 'https://pcmap.place.naver.com/restaurant/list?query=%EC%B0%BD%EC%9B%90%EC%8B%9C+%EC%83%88%EB%A1%9C%EC%98%A4%ED%94%88+%EB%A7%9B%EC%A7%91';
  console.log('접속:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(5000);

  console.log('현재 URL:', page.url());

  // Apollo 확인
  const apolloCheck = await page.evaluate(() => {
    const apollo = (window as any).__APOLLO_STATE__;
    if (!apollo) return { exists: false, keys: [] };
    const keys = Object.keys(apollo);
    const placeKeys = keys.filter((k) => k.startsWith('Place:'));
    return {
      exists: true,
      totalKeys: keys.length,
      placeKeys: placeKeys.slice(0, 10),
      sampleKeys: keys.slice(0, 20),
    };
  });
  console.log('\nApollo:', JSON.stringify(apolloCheck, null, 2));

  // script 태그에서 ID 찾기
  const scriptIds = await page.evaluate(() => {
    const ids = new Set<string>();
    for (const s of document.querySelectorAll('script')) {
      const text = s.textContent ?? '';
      for (const m of text.matchAll(/"id"\s*:\s*"(\d{7,})"/g)) ids.add(m[1]);
    }
    return [...ids];
  });
  console.log('\nScript IDs:', scriptIds);

  // TYaxT (맛집 이름) 확인
  const names = await page.$$eval('[class*="TYaxT"]', (els) =>
    els.slice(0, 5).map((el) => el.textContent?.trim())
  );
  console.log('\n맛집 이름들:', names);

  // 맛집 이름 부모 <a> 태그의 onclick/href 확인
  const parentLinks = await page.$$eval('[class*="TYaxT"]', (els) =>
    els.slice(0, 5).map((el) => {
      const a = el.closest('a');
      return {
        name: el.textContent?.trim(),
        href: a?.getAttribute('href')?.slice(0, 100),
        onclick: a?.getAttribute('onclick')?.slice(0, 100),
        dataId: a?.getAttribute('data-id'),
        parentClass: a?.className?.slice(0, 80),
      };
    })
  );
  console.log('\n링크 정보:', JSON.stringify(parentLinks, null, 2));

  // 맛집 이름 클릭 시 URL 변화 확인
  if (names.length > 0) {
    console.log(`\n"${names[0]}" 클릭 시도...`);
    const firstItem = await page.$('[class*="TYaxT"]');
    if (firstItem) {
      const parent = await firstItem.evaluateHandle((el) => el.closest('a') || el.parentElement);
      await (parent as any).click();
      await page.waitForTimeout(3000);
      console.log('클릭 후 URL:', page.url());

      // 클릭 후 Apollo 재확인
      const afterApollo = await page.evaluate(() => {
        const apollo = (window as any).__APOLLO_STATE__;
        if (!apollo) return [];
        return Object.keys(apollo).filter((k) => k.startsWith('Place:')).slice(0, 5);
      });
      console.log('클릭 후 Place keys:', afterApollo);
    }
  }

  console.log('\n10초 후 종료...');
  await page.waitForTimeout(10000);
  await browser.close();
}

debug().catch(console.error);
