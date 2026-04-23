/**
 * naver-login-setup.ts — 네이버 1회 수동 로그인 후 쿠키 저장
 *
 * 사용법:
 *   npx tsx src/naver-login-setup.ts
 *
 * - 보이는 Chrome 창이 열립니다
 * - 네이버에 직접 로그인하세요 (NAVER_ID/NAVER_PW 불필요)
 * - 로그인 완료 후 Enter를 누르면 쿠키가 저장됩니다
 * - 이후 naver-folder.ts가 저장된 쿠키로 자동 로그인합니다
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const COOKIE_FILE = path.join(new URL('../logs/naver-cookies.json', import.meta.url).pathname);
const LOGS_DIR    = path.dirname(COOKIE_FILE);

async function waitForLogin(page: import('playwright').Page, timeoutMs = 120_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = page.url();
    if (!url.includes('nid.naver.com')) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  네이버 로그인 쿠키 설정');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Chrome 창이 열립니다. 네이버에 직접 로그인하세요.');
  console.log('로그인 완료 시 자동으로 쿠키가 저장됩니다.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--lang=ko-KR'],
  });

  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('https://nid.naver.com/nidlogin.login', {
    waitUntil: 'domcontentloaded',
  });

  console.log('⏳ 로그인 대기 중... (최대 2분)');
  const loggedIn = await waitForLogin(page);

  if (!loggedIn) {
    console.log('\n⚠️  시간 초과. 다시 실행하세요.');
    await browser.close();
    process.exit(1);
  }

  // 쿠키 저장
  const cookies = await context.cookies();
  const naverCookies = cookies.filter(
    (c) => c.domain.includes('naver.com'),
  );

  if (naverCookies.length === 0) {
    console.log('\n⚠️  네이버 쿠키를 찾을 수 없습니다. 로그인 후 다시 시도하세요.');
    await browser.close();
    process.exit(1);
  }

  mkdirSync(LOGS_DIR, { recursive: true });
  writeFileSync(COOKIE_FILE, JSON.stringify(naverCookies, null, 2), 'utf-8');

  console.log(`\n✅ 쿠키 저장 완료 (${naverCookies.length}개)`);
  console.log(`   경로: ${COOKIE_FILE}`);
  console.log('\n이제 naver-folder.ts가 로그인 없이 폴더를 크롤링합니다.');
  console.log('쿠키 만료 시 이 명령어를 다시 실행하세요.\n');

  await browser.close();
  process.exit(0);
}

main();
