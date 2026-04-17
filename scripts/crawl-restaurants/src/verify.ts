import 'dotenv/config';
import { chromium, type Page } from 'playwright';
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

    // 폐업/휴업 명시적 텍스트 감지
    const closedPatterns = [
      /영업\s*종료/,
      /폐업/,
      /휴업/,
      /존재하지\s*않는\s*업체/,
      /삭제된\s*업체/,
      /지역을\s*이전/,
    ];

    for (const p of closedPatterns) {
      const m = bodyText.match(p);
      if (m) return { status: 'closed_text', reason: m[0] };
    }

    // 최소한의 기본 정보 확인 (이름이 뽑히는지)
    const title = await page.evaluate(
      () => document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
    );
    if (!title) return { status: 'not_found' };

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

  const browser = await chromium.launch({ headless: true, args: ['--lang=ko-KR'] });
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
        // 의심 카운트 증가
        const nextCount = (r.suspicion_count ?? 0) + 1;
        const confidence = Math.min(30 + (nextCount - 1) * 30, 95);

        if (nextCount >= 3) {
          // 3회 연속 — inactive 확정
          await updateClosureStatus(r.id, {
            operating_status: 'inactive',
            suspicion_count: nextCount,
            closure_confidence: 90,
            closure_source: 'naver_404',
            closed_at: now,
            last_verified_at: now,
          });
          newlyClosed.push({ name: r.name, reason: 'naver_404 (3회 연속)', placeId: r.naver_place_id });
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
