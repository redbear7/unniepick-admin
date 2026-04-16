import 'dotenv/config';
import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://pcmap.place.naver.com/restaurant/list?query=%EC%B0%BD%EC%9B%90%EC%8B%9C+%EC%83%88%EB%A1%9C%EC%98%A4%ED%94%88+%EB%A7%9B%EC%A7%91', {
    waitUntil: 'networkidle', timeout: 20_000,
  });
  await page.waitForTimeout(3000);

  // 1. 보이는 맛집 이름 (TYaxT) = 실제 검색 결과
  const visibleNames = await page.$$eval('[class*="TYaxT"]', (els) =>
    els.map((el) => el.textContent?.trim() ?? '')
  );

  // 2. RestaurantListSummary 엔트리
  const apolloEntries = await page.evaluate(() => {
    const apollo = (window as any).__APOLLO_STATE__;
    if (!apollo) return [];
    const entries: Array<{ key: string; id: string; name: string }> = [];
    for (const [key, val] of Object.entries(apollo) as [string, any][]) {
      const m = key.match(/^RestaurantListSummary:(\d+):/);
      if (m) entries.push({ key, id: m[1], name: val.name ?? '' });
    }
    return entries;
  });

  console.log(`보이는 맛집 (TYaxT): ${visibleNames.length}개`);
  console.log(`Apollo RestaurantListSummary: ${apolloEntries.length}개`);
  console.log(`\n차이: ${apolloEntries.length - visibleNames.length}개 초과\n`);

  // 어떤 것이 보이지 않는 업체인지 확인
  const visibleSet = new Set(visibleNames);
  const notVisible = apolloEntries.filter((e) => !visibleSet.has(e.name));
  const visible = apolloEntries.filter((e) => visibleSet.has(e.name));

  console.log('--- 보이는 업체 (검색 결과) ---');
  visible.forEach((e, i) => console.log(`  ${i + 1}. ${e.name} [${e.id}]`));

  console.log(`\n--- 보이지 않는 업체 (${notVisible.length}개) ---`);
  notVisible.forEach((e, i) => console.log(`  ${i + 1}. ${e.name} [${e.id}]`));

  // Apollo 키 패턴 분석 (어디서 참조되는지)
  console.log('\n--- Apollo 키 패턴 분석 (보이지 않는 업체) ---');
  const apollo = await page.evaluate(() => (window as any).__APOLLO_STATE__);
  for (const entry of notVisible.slice(0, 5)) {
    const refs: string[] = [];
    for (const [key, val] of Object.entries(apollo) as [string, any][]) {
      const valStr = JSON.stringify(val);
      if (valStr.includes(entry.id) && !key.includes(entry.id)) {
        refs.push(key.slice(0, 60));
      }
    }
    console.log(`  ${entry.name}: 참조됨 by ${refs.length > 0 ? refs.join(', ') : '자기 자신만'}`);
  }

  await browser.close();
}

debug().catch(console.error);
