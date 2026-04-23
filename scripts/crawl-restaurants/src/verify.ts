import 'dotenv/config';
import { type Page } from 'playwright';
import { stealthChromium, LAUNCH_ARGS } from './stealth-browser.js';
import {
  getRestaurantsForVerification,
  updateClosureStatus,
} from './storage.js';
import { notifyClosureReport } from './notify.js';

type CheckResult =
  | { status: 'ok' }
  | { status: 'closed_text'; reason: string }
  | { status: 'not_found' }
  | { status: 'network_error'; reason: string };

/**
 * 네이버 플레이스 페이지 재접근으로 영업 상태 확인
 */
async function checkNaverPlace(page: Page, placeId: string): Promise<CheckResult> {
  try {
    const res = await page.goto(
      `https://pcmap.place.naver.com/restaurant/${placeId}/home`,
      { waitUntil: 'networkidle', timeout: 15_000 },
    );

    if (!res || res.status() === 404) return { status: 'not_found' };

    await page.waitForTimeout(1500);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // ⚠️ 중요: "영업 종료"는 "오늘 영업시간 종료"를 의미할 뿐 폐업이 아님!
    // Naver Place에서 실제 폐업은 다음 경우:
    // 1. 페이지 자체가 404 또는 "존재하지 않는 업체" 표시
    // 2. 명시적으로 "폐업" 단어 + 컨텍스트 (예: "폐업되었습니다", "폐업된 업체")

    // 진짜 폐업 시그널 (엄격)
    const TRUE_CLOSED_PATTERNS = [
      /존재하지\s*않는\s*업체/,
      /삭제된\s*업체/,
      /폐업되었습니다/,
      /폐업한\s*업체/,
      /영업을\s*중단/,
      /영업\s*중단/,
    ];

    for (const p of TRUE_CLOSED_PATTERNS) {
      const m = bodyText.match(p);
      if (m) return { status: 'closed_text', reason: m[0] };
    }

    // 최소한의 기본 정보 확인 (이름이 뽑히는지)
    const title = await page.evaluate(
      () => document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
    );
    if (!title) return { status: 'not_found' };

    // "영업 종료" 는 today closed, "영업 중" 은 현재 영업중 — 모두 active
    return { status: 'ok' };
  } catch (e) {
    return { status: 'network_error', reason: (e as Error).message };
  }
}

/** 메인 검증 루틴 */
async function verify() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${new Date().toLocaleString('ko-KR')}] 폐업 검증 시작`);
  console.log(`${'='.repeat(50)}`);

  const targets = await getRestaurantsForVerification();
  console.log(`검증 대상: ${targets.length}개`);

  if (targets.length === 0) {
    console.log('대상 없음. 종료.');
    return;
  }

  const browser = await stealthChromium.launch(LAUNCH_ARGS as any);
  const page = await browser.newPage();

  const now = new Date().toISOString();

  const newlyClosed: Array<{ name: string; reason: string; placeId: string }> = [];
  const newlySuspected: Array<{ name: string; count: number }> = [];
  const recovered: string[] = [];
  let okCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      const result = await checkNaverPlace(page, r.naver_place_id);

      if (result.status === 'ok') {
        // 정상 — active로 복귀 (이전에 suspected였으면)
        if (r.operating_status !== 'active') {
          recovered.push(r.name);
        }
        await updateClosureStatus(r.id, {
          operating_status: 'active',
          suspicion_count: 0,
          closure_confidence: 0,
          last_verified_at: now,
        });
        okCount++;
      } else if (result.status === 'closed_text') {
        // 명시적 폐업 — 즉시 inactive
        await updateClosureStatus(r.id, {
          operating_status: 'inactive',
          closure_confidence: 100,
          closure_source: 'naver_closed_text',
          closed_at: now,
          last_verified_at: now,
        });
        newlyClosed.push({ name: r.name, reason: result.reason, placeId: r.naver_place_id });
      } else if (result.status === 'not_found') {
        // 의심 카운트 증가 (페이지 자체가 없음 — 진짜 폐업 가능성)
        const nextCount = (r.suspicion_count ?? 0) + 1;
        const confidence = Math.min(20 + (nextCount - 1) * 25, 90);

        if (nextCount >= 4) {
          // 4회 연속 — inactive 확정 (3회 → 4회로 상향 조정)
          await updateClosureStatus(r.id, {
            operating_status: 'inactive',
            suspicion_count: nextCount,
            closure_confidence: 90,
            closure_source: 'naver_404',
            closed_at: now,
            last_verified_at: now,
          });
          newlyClosed.push({ name: r.name, reason: 'naver_404 (4회 연속)', placeId: r.naver_place_id });
        } else {
          // 의심 단계
          await updateClosureStatus(r.id, {
            operating_status: 'suspected',
            suspicion_count: nextCount,
            closure_confidence: confidence,
            last_verified_at: now,
          });
          if (r.operating_status !== 'suspected') {
            newlySuspected.push({ name: r.name, count: nextCount });
          }
        }
      } else {
        // 네트워크 에러 — 상태 변경 없음, 로그만
        errorCount++;
      }

      const label = result.status === 'ok' ? '✓'
        : result.status === 'closed_text' ? '🔴'
        : result.status === 'not_found' ? '🟡'
        : '⚠️';
      console.log(`  [${i + 1}/${targets.length}] ${label} ${r.name}`);

      // 과부하 방지 (3~5초 랜덤)
      await page.waitForTimeout(3000 + Math.random() * 2000);
    }
  } finally {
    await browser.close();
  }

  // 결과 요약
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ 영업 확인: ${okCount}개`);
  console.log(`🔴 신규 폐업: ${newlyClosed.length}개`);
  console.log(`🟡 신규 의심: ${newlySuspected.length}개`);
  console.log(`♻️ 복구: ${recovered.length}개`);
  console.log(`⚠️ 에러: ${errorCount}개`);

  if (newlyClosed.length) {
    console.log('\n폐업 업체:');
    newlyClosed.forEach((c) => console.log(`  • ${c.name} — ${c.reason}`));
  }

  // 텔레그램 리포트
  await notifyClosureReport({
    okCount,
    newlyClosed,
    newlySuspected,
    recovered,
    errorCount,
    total: targets.length,
  });
}

verify()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('검증 실패:', e);
    process.exit(1);
  });
