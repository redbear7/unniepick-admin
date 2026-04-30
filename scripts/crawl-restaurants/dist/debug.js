import 'dotenv/config';
import { chromium } from 'playwright';
/**
 * 디버그 스크립트: 네이버 플레이스 검색 페이지의 실제 HTML 구조를 확인
 */
async function debug() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    const query = '창원 신상맛집';
    const url = `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`;
    console.log(`\n접속 URL: ${url}\n`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    // 현재 URL 확인 (리다이렉트 여부)
    console.log('현재 URL:', page.url());
    // 스크린샷 저장
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
    console.log('스크린샷 저장: debug-screenshot.png');
    // 페이지 내 주요 셀렉터 존재 여부 확인
    const selectors = [
        '#_pcmap_list_scroll_container',
        '[class*="scroll"]',
        '[class*="list"]',
        '[class*="item"]',
        'a[href*="/restaurant/"]',
        'a[href*="/place/"]',
        '[class*="place_bluelink"]',
        '[class*="TYaxT"]',
        '[class*="tzwk0"]',
        'li[class*="VLTHu"]',
        '[data-nclick]',
        '#searchIframe',
        'iframe',
    ];
    console.log('\n--- 셀렉터 확인 ---');
    for (const sel of selectors) {
        const count = await page.$$eval(sel, (els) => els.length).catch(() => 0);
        console.log(`  ${sel} → ${count}개`);
    }
    // iframe 확인
    const frames = page.frames();
    console.log(`\n--- 프레임 수: ${frames.length} ---`);
    for (const frame of frames) {
        console.log(`  frame: ${frame.name()} | ${frame.url().slice(0, 100)}`);
    }
    // 메인 프레임이 아닌 iframe 안에 리스트가 있을 수 있음
    if (frames.length > 1) {
        for (const frame of frames) {
            if (frame === page.mainFrame())
                continue;
            const links = await frame.$$eval('a[href*="/restaurant/"], a[href*="/place/"]', (els) => els.length).catch(() => 0);
            console.log(`  frame "${frame.name()}" 내 맛집 링크: ${links}개`);
            const listItems = await frame.$$eval('li', (els) => els.length).catch(() => 0);
            console.log(`  frame "${frame.name()}" 내 li 수: ${listItems}개`);
        }
    }
    // body 내 텍스트 일부 출력
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log('\n--- body 텍스트 (앞 2000자) ---');
    console.log(bodyText);
    // 10초 대기 후 닫기 (눈으로 확인용)
    console.log('\n10초 후 브라우저 닫힘...');
    await page.waitForTimeout(10000);
    await browser.close();
}
debug().catch(console.error);
