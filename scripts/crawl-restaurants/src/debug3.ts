import 'dotenv/config';
import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: false });

  // ── 1. 창원관광포털 ──
  console.log('\n=== 창원관광포털 ===');
  const p1 = await browser.newPage();
  await p1.goto('https://www.changwon.go.kr/tour/index.do?menuCode=001_004004002000&search.searchCategory=CGR', {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });
  await p1.waitForTimeout(3000);
  await p1.screenshot({ path: 'debug-changwon.png', fullPage: true });

  const cwText = await p1.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('body 텍스트:\n', cwText);

  // 모든 li 확인
  const cwLis = await p1.$$eval('li', (els) =>
    els.slice(0, 30).map((el) => ({
      class: el.className.slice(0, 80),
      text: el.textContent?.slice(0, 100)?.trim(),
      hasImg: !!el.querySelector('img'),
    })).filter((x) => x.text && x.text.length > 3)
  );
  console.log('\nli 요소들:', JSON.stringify(cwLis.slice(0, 15), null, 2));

  // dl/dd 패턴 확인
  const cwDls = await p1.$$eval('dl, dd, dt, .item, .card, article, .cont', (els) =>
    els.slice(0, 10).map((el) => ({
      tag: el.tagName,
      class: el.className.slice(0, 80),
      text: el.textContent?.slice(0, 150)?.trim(),
    }))
  );
  console.log('\ndl/article 요소들:', JSON.stringify(cwDls, null, 2));
  await p1.close();

  // ── 2. 블루리본 ──
  console.log('\n=== 블루리본 ===');
  const p2 = await browser.newPage();
  try {
    await p2.goto('https://www.bluer.co.kr/search?query=&zone1=%EA%B2%BD%EB%82%A8&zone2=%EC%B0%BD%EC%9B%90%EC%8B%9C', {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    await p2.waitForTimeout(3000);
    await p2.screenshot({ path: 'debug-blueribbon.png', fullPage: true });

    const brText = await p2.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log('body 텍스트:\n', brText);

    // 모든 a 태그 중 맛집 이름 후보
    const brItems = await p2.$$eval('a, div, li, article', (els) =>
      els.slice(0, 50).map((el) => ({
        tag: el.tagName,
        class: el.className.slice(0, 80),
        text: el.textContent?.slice(0, 80)?.trim(),
      })).filter((x) => x.text && x.text.length > 2 && x.text.length < 50)
    );
    console.log('\n요소들 (처음 20개):', JSON.stringify(brItems.slice(0, 20), null, 2));
  } catch (e) {
    console.log('블루리본 에러:', (e as Error).message);
  }
  await p2.close();

  console.log('\n5초 후 종료...');
  await new Promise((r) => setTimeout(r, 5000));
  await browser.close();
}

debug().catch(console.error);
