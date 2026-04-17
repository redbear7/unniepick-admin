/**
 * POST /api/crawl-restaurants/single
 *   body: { query: string, analyze_reviews?: boolean }
 *   → 단일 업체 크롤링 시작 (detached 프로세스)
 *
 * GET /api/crawl-restaurants/single
 *   → 상태 + 최근 결과 반환
 *
 * DELETE /api/crawl-restaurants/single
 *   → 실행 중인 크롤링 중지 + 결과 파일 초기화
 */
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const SCRIPT_DIR = path.join(process.cwd(), 'scripts', 'crawl-restaurants');
const TSX_BIN = path.join(SCRIPT_DIR, 'node_modules', '.bin', 'tsx');
const LOGS_DIR = path.join(SCRIPT_DIR, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'single.log');
const RESULT_FILE = path.join(LOGS_DIR, 'single-result.json');
const PID_FILE = path.join(LOGS_DIR, 'single.pid');

function ensureLogsDir() {
  mkdirSync(LOGS_DIR, { recursive: true });
}

function readResult() {
  try {
    if (!existsSync(RESULT_FILE)) return null;
    return JSON.parse(readFileSync(RESULT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function readPid(): number | null {
  try {
    if (!existsSync(PID_FILE)) return null;
    return parseInt(readFileSync(PID_FILE, 'utf-8').trim()) || null;
  } catch {
    return null;
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** GET — 현재 상태 + 최근 결과 + 로그 */
export async function GET() {
  const pid = readPid();
  const running = pid ? isRunning(pid) : false;

  // 로그 파일 읽기 (마지막 100KB)
  let log = '';
  try {
    if (existsSync(LOG_FILE)) {
      const buf = readFileSync(LOG_FILE);
      const tail = buf.slice(-100 * 1024);
      log = tail.toString('utf-8');
    }
  } catch {}

  const result = readResult();

  return NextResponse.json({ running, pid: running ? pid : null, log, result });
}

/** POST — 크롤링 시작 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, analyze_reviews } = body as { query?: string; analyze_reviews?: boolean };

  if (!query?.trim()) {
    return NextResponse.json({ error: '쿼리(query)가 필요합니다 (예: "마산 불낙명가")' }, { status: 400 });
  }

  // 이미 실행 중인지 체크
  const pid = readPid();
  if (pid && isRunning(pid)) {
    return NextResponse.json(
      { error: '이미 크롤링이 실행 중입니다. 잠시 후 다시 시도하세요.' },
      { status: 409 },
    );
  }

  ensureLogsDir();

  // 이전 결과 초기화
  try { writeFileSync(RESULT_FILE, '', 'utf-8'); } catch {}

  const logFd = openSync(LOG_FILE, 'w'); // 이전 로그 덮어쓰기

  const scriptArgs = [`src/single.ts`, `--query=${query.trim()}`];
  if (analyze_reviews) scriptArgs.push('--analyze-reviews');

  const child = spawn(TSX_BIN, scriptArgs, {
    cwd: SCRIPT_DIR,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });
  child.unref();

  // PID 저장
  writeFileSync(PID_FILE, String(child.pid), 'utf-8');

  return NextResponse.json({ ok: true, pid: child.pid, query: query.trim() });
}

/** DELETE — 크롤링 중지 */
export async function DELETE() {
  const pid = readPid();

  if (!pid) {
    return NextResponse.json({ ok: true, killed: false, reason: 'PID 없음' });
  }

  try {
    try { process.kill(-pid, 'SIGTERM'); } catch {}
    try { process.kill(pid, 'SIGTERM'); } catch {}

    // PID 파일 삭제
    try { writeFileSync(PID_FILE, '', 'utf-8'); } catch {}

    return NextResponse.json({ ok: true, killed: true, pid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
