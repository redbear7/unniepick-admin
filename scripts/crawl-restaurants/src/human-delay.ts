/**
 * human-delay.ts — 인간처럼 느린 크롤링 유틸
 *
 * 봇 탐지 회피를 위해 랜덤 딜레이, 간헐적 긴 멈춤(읽는 척),
 * 미세 흔들림(jitter)을 조합해 사람처럼 보이게 한다.
 */

// ── 메인 딜레이 (페이지 간 이동, 키워드 간 간격) ────────────────────────────

/**
 * 인간형 랜덤 딜레이
 * - 기본 범위에 가우시안 노이즈 + 5% 확률로 긴 멈춤(읽는 척)
 */
export async function humanDelay(minMs = 2000, maxMs = 5000): Promise<void> {
  const base     = minMs + Math.random() * (maxMs - minMs);
  // 가우시안 분포 근사 (Box-Muller 없이): 3번 평균
  const jitter   = (Math.random() + Math.random() + Math.random()) / 3 * 800 - 400;
  // 5% 확률로 긴 멈춤 (읽는 척 — 3~8초 추가)
  const longRead = Math.random() < 0.05 ? 3000 + Math.random() * 5000 : 0;
  const total    = Math.max(500, base + jitter + longRead);
  await new Promise(r => setTimeout(r, total));
}

/**
 * 짧은 마이크로 딜레이 (스크롤, 클릭, 입력 사이)
 */
export async function microDelay(minMs = 150, maxMs = 600): Promise<void> {
  await new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

/**
 * 페이지 내 스크롤 딜레이 (페이지 로딩 기다리는 느낌)
 */
export async function scrollDelay(): Promise<void> {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
}

// ── 경과 시간 ────────────────────────────────────────────────────────────────

export function fmtElapsed(startMs: number): string {
  const total = Math.floor((Date.now() - startMs) / 1000);
  const h     = Math.floor(total / 3600);
  const m     = Math.floor((total % 3600) / 60);
  const s     = total % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

// ── 진행 타이머 ──────────────────────────────────────────────────────────────

export interface CrawlTimer {
  elapsed: () => string;
  startMs: number;
  log: (msg: string) => void;
  step: (current: number, total: number, label: string) => void;
  done: (found: number, isNew: number) => void;
}

export function createTimer(label = '크롤링'): CrawlTimer {
  const start = Date.now();
  return {
    startMs: start,
    elapsed: () => fmtElapsed(start),
    log: (msg: string) => {
      process.stdout.write(`  [${fmtElapsed(start)}] ${msg}\n`);
    },
    step: (current: number, total: number, stepLabel: string) => {
      const pct  = total > 0 ? Math.round((current / total) * 100) : 0;
      const bar  = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
      process.stdout.write(`\r  [${fmtElapsed(start)}] |${bar}| ${pct}% (${current}/${total}) ${stepLabel}     `);
    },
    done: (found: number, newCount: number) => {
      process.stdout.write('\n');
      console.log(`  ✅ ${label} 완료 | 수집 ${found}개 | 신규 ${newCount}개 | 소요 ${fmtElapsed(start)}`);
    },
  };
}
