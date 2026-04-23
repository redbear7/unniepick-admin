/**
 * stealth-browser.ts — Stealth 적용 Chromium 인스턴스
 *
 * playwright-extra + puppeteer-extra-plugin-stealth 조합으로
 * navigator.webdriver 숨김, Canvas/WebGL 핑거프린트 일반화,
 * Chrome runtime API 주입 등 봇 탐지 우회를 자동 처리한다.
 *
 * 사용:
 *   import { stealthChromium, LAUNCH_ARGS } from './stealth-browser.js';
 *   const browser = await stealthChromium.launch(LAUNCH_ARGS);
 */
import { chromium as playwrightExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

playwrightExtra.use(StealthPlugin());

export const stealthChromium = playwrightExtra;

export const LAUNCH_ARGS = {
  headless: true,
  args: [
    '--lang=ko-KR',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ],
} as const;
