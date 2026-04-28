/**
 * stealth-browser.ts — Stealth Chromium 인스턴스
 *
 * playwright-extra / puppeteer-extra-plugin-stealth 대신
 * 네이티브 Playwright chromium + launch args + addInitScript 조합 사용.
 *
 * - playwright-extra는 비공식 래퍼라 Playwright 업데이트 시 호환성 깨질 위험이 있음
 * - 네이티브 방식은 공식 API만 사용하므로 안정적
 *
 * 사용:
 *   import { stealthChromium, LAUNCH_ARGS, injectStealth, waitForApollo } from './stealth-browser.js';
 *   const browser = await stealthChromium.launch(LAUNCH_ARGS);
 *   const page = await browser.newPage();
 *   await injectStealth(page);          // 봇 탐지 우회 스크립트 주입
 *   await page.goto(url, { waitUntil: 'networkidle' });
 *   await waitForApollo(page);          // Apollo 데이터 로드 확인
 */
import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import type { PlaywrightProxy } from './proxy.js';

export const stealthChromium = chromium;

const BASE_ARGS = [
  '--lang=ko-KR',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--disable-features=IsolateOrigins',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-infobars',
] as const;

/** 프록시 없는 기본 실행 인수 (하위 호환) */
export const LAUNCH_ARGS = {
  headless: true,
  args: BASE_ARGS,
} as const;

/** 프록시를 포함한 실행 옵션 반환 */
export function makeLaunchArgs(proxy?: PlaywrightProxy) {
  return {
    headless: true,
    args: BASE_ARGS as readonly string[],
    ...(proxy ? { proxy } : {}),
  };
}

// ── 봇 탐지 우회 초기화 스크립트 ─────────────────────────────
const STEALTH_SCRIPT = `
  // navigator.webdriver 숨김
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // plugins 배열 (빈 배열이면 봇으로 탐지)
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

  // 언어 설정
  Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });

  // Chrome 런타임 주입 (없으면 headless 탐지됨)
  if (!window.chrome) {
    window.chrome = {
      runtime: {
        onConnect:  { addListener: () => {} },
        onMessage:  { addListener: () => {} },
      },
    };
  }

  // WebGL 핑거프린트 일반화
  try {
    const origGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(p) {
      if (p === 37445) return 'Intel Inc.';
      if (p === 37446) return 'Intel Iris OpenGL Engine';
      return origGetParameter.call(this, p);
    };
  } catch {}
`;

/**
 * Page 또는 BrowserContext에 스텔스 스크립트 주입.
 * - Page: 해당 페이지의 모든 후속 내비게이션에 적용
 * - BrowserContext: 해당 컨텍스트의 모든 페이지·내비게이션에 적용
 */
export async function injectStealth(target: Page | BrowserContext): Promise<void> {
  await target.addInitScript(STEALTH_SCRIPT);
}

/**
 * __APOLLO_STATE__ 데이터가 채워질 때까지 대기 (최대 5초).
 * 네이버 플레이스 Apollo 기반 페이지에서 data 확보 후 evaluate 하기 전 호출.
 */
export async function waitForApollo(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const state = (window as any).__APOLLO_STATE__;
        return state != null && Object.keys(state).length > 2;
      },
      { timeout: 5_000 },
    );
  } catch {
    // 타임아웃 — 그대로 진행 (Apollo 없는 페이지이거나 느린 로딩)
  }
}

/**
 * 리뷰/목록 페이지 본문이 충분히 로드될 때까지 대기 (최대 5초).
 */
export async function waitForContent(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      () => document.body.innerText.length > 500,
      { timeout: 5_000 },
    );
  } catch {}
}
