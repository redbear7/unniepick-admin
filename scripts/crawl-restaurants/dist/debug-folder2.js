import 'dotenv/config';
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';
const COOKIE_FILE = path.join(new URL('../logs/naver-cookies.json', import.meta.url).pathname);
async function main() {
    const browser = await chromium.launch({ headless: true, args: ['--lang=ko-KR'] });
    const context = await browser.newContext();
    const cookies = JSON.parse(readFileSync(COOKIE_FILE, 'utf-8'));
    await context.addCookies(cookies);
    const page = await context.newPage();
    // 폴더 해시 추출
    const folderHash = '3ff79c32c6f748ac9ded424f1184aaf6';
    const apiUrl = `https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/${folderHash}/bookmarks?placeInfo=true&start=0&limit=100&sort=lastUseTime&mcids=ALL&createIdNo=true`;
    const res = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: 'include' });
        return { status: r.status, body: await r.text() };
    }, apiUrl);
    console.log('Status:', res.status);
    console.log('Response (처음 2000자):\n', res.body.slice(0, 2000));
    await browser.close();
}
main().catch(console.error);
