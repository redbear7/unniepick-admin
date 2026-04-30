import 'dotenv/config';
import { chromium } from 'playwright';
async function debug() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    const query = '창원 신상맛집';
    const url = `https://pcmap.place.naver.com/restaurant/list?query=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    // TYaxT 클래스 요소의 구조 확인
    const tyaxtInfo = await page.$$eval('[class*="TYaxT"]', (els) => els.slice(0, 3).map((el) => ({
        tag: el.tagName,
        className: el.className,
        innerHTML: el.innerHTML.slice(0, 500),
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className?.slice(0, 100),
    })));
    console.log('\n--- TYaxT 요소 구조 (처음 3개) ---');
    console.log(JSON.stringify(tyaxtInfo, null, 2));
    // item 클래스 요소 확인
    const itemInfo = await page.$$eval('[class*="item"]', (els) => els.slice(0, 3).map((el) => ({
        tag: el.tagName,
        className: el.className.slice(0, 100),
        childLinks: Array.from(el.querySelectorAll('a')).map((a) => ({
            href: a.getAttribute('href')?.slice(0, 150),
            text: a.textContent?.slice(0, 50),
        })),
    })));
    console.log('\n--- item 요소 구조 (처음 3개) ---');
    console.log(JSON.stringify(itemInfo, null, 2));
    // 모든 a 태그의 href 패턴 분석
    const allHrefs = await page.$$eval('a[href]', (els) => els.map((a) => a.getAttribute('href') ?? '').filter((h) => h.includes('place') || h.includes('restaurant') || h.match(/\/\d{5,}/)));
    console.log('\n--- place/restaurant 관련 링크 ---');
    console.log(allHrefs.slice(0, 20));
    // 숫자 ID가 포함된 모든 링크
    const idLinks = await page.$$eval('a[href]', (els) => els.map((a) => a.getAttribute('href') ?? '').filter((h) => /\/\d{7,}/.test(h)));
    console.log('\n--- 숫자 ID 포함 링크 ---');
    console.log(idLinks.slice(0, 20));
    // data-cid 또는 data-id 속성 확인
    const dataIds = await page.$$eval('[data-cid], [data-id], [data-sid]', (els) => els.slice(0, 10).map((el) => ({
        tag: el.tagName,
        dataCid: el.getAttribute('data-cid'),
        dataId: el.getAttribute('data-id'),
        dataSid: el.getAttribute('data-sid'),
    })));
    console.log('\n--- data-cid/data-id/data-sid 요소 ---');
    console.log(JSON.stringify(dataIds, null, 2));
    // window.__APOLLO_STATE__ 또는 __NEXT_DATA__ 같은 JSON 데이터 확인
    const hasApollo = await page.evaluate(() => !!window.__APOLLO_STATE__);
    const hasNext = await page.evaluate(() => !!window.__NEXT_DATA__);
    console.log('\n--- 글로벌 데이터 ---');
    console.log(`__APOLLO_STATE__: ${hasApollo}`);
    console.log(`__NEXT_DATA__: ${hasNext}`);
    // script 태그에서 place ID 패턴 찾기
    const scriptIds = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        const ids = new Set();
        for (const s of scripts) {
            const text = s.textContent ?? '';
            const matches = text.matchAll(/"id"\s*:\s*"?(\d{7,})"?/g);
            for (const m of matches)
                ids.add(m[1]);
        }
        return [...ids];
    });
    console.log('\n--- script 내 place ID들 ---');
    console.log(scriptIds.slice(0, 20));
    await page.waitForTimeout(5000);
    await browser.close();
}
debug().catch(console.error);
