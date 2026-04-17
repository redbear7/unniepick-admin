/**
 * 폐업 감지 알고리즘 검증 스크립트
 *
 * 실제 영업 중인 가게 1~3개만 테스트해서 오탐 여부 확인
 * 사용: npx tsx src/verify-test.ts
 */
import 'dotenv/config';
import { chromium } from 'playwright';

const TRUE_CLOSED_PATTERNS = [
  /존재하지\s*않는\s*업체/,
  /삭제된\s*업체/,
  /폐업되었습니다/,
  /폐업한\s*업체/,
  /영업을\s*중단/,
  /영업\s*중단/,
];

async function test() {
  // 테스트 대상: 영업중인 것으로 알려진 케이스
  const testCases = [
    { placeId: '2013464939', name: '속초오징어어시장 산호점', expected: 'ok' },
    { placeId: '2022047684', name: '할매기름집 상남점', expected: 'ok' },
    { placeId: '2027509634', name: '우이락 창원대방점', expected: 'ok' },
    // 일부러 존재하지 않는 ID
    { placeId: '9999999999', name: '(테스트: 존재하지 않는 ID)', expected: 'not_found' },
  ];

  const browser = await chromium.launch({ headless: true, args: ['--lang=ko-KR'] });
  const page = await browser.newPage();

  console.log('\n=== 폐업 감지 알고리즘 검증 ===\n');

  for (const tc of testCases) {
    console.log(`[${tc.placeId}] ${tc.name}`);
    try {
      const res = await page.goto(
        `https://pcmap.place.naver.com/restaurant/${tc.placeId}/home`,
        { waitUntil: 'networkidle', timeout: 15_000 },
      );

      if (!res || res.status() === 404) {
        console.log(`  → not_found (HTTP ${res?.status()})`);
        continue;
      }

      await page.waitForTimeout(1500);
      const bodyText = await page.evaluate(() => document.body.innerText);

      // "영업 종료" 카운트 (이전 버전 오탐 원인)
      const naiveClosed = bodyText.match(/영업\s*종료/);
      console.log(`  "영업 종료" 매칭: ${naiveClosed ? '✓ (이전엔 오탐이었음)' : '없음'}`);

      // 진짜 폐업 패턴 체크
      let trueClosed = null;
      for (const p of TRUE_CLOSED_PATTERNS) {
        const m = bodyText.match(p);
        if (m) { trueClosed = m[0]; break; }
      }

      const title = await page.evaluate(
        () => document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
      );

      let status = 'ok';
      if (!title) status = 'not_found';
      else if (trueClosed) status = 'closed_text';

      const match = status === tc.expected ? '✅' : '❌';
      console.log(`  → ${status} ${match} (기대값: ${tc.expected})`);
      if (trueClosed) console.log(`  진짜 폐업 패턴 감지: "${trueClosed}"`);

    } catch (e) {
      console.log(`  에러: ${(e as Error).message}`);
    }
    console.log('');
  }

  await browser.close();
  process.exit(0);
}

test().catch(console.error);
