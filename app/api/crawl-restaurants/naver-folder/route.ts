/**
 * POST /api/crawl-restaurants/naver-folder
 *   body: { folder_url: string }
 *   → 네이버 내 장소 폴더 크롤링 시작
 *
 * GET  → 진행 상태 + 결과
 * DELETE → 중지
 */
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const SCRIPT_DIR  = path.join(process.cwd(), 'scripts', 'crawl-restaurants');
const TSX_BIN     = path.join(SCRIPT_DIR, 'node_modules', '.bin', 'tsx');
const LOGS_DIR    = path.join(SCRIPT_DIR, 'logs');
const LOG_FILE    = path.join(LOGS_DIR, 'naver-folder.log');
const RESULT_FILE = path.join(LOGS_DIR, 'folder-result.json');
const PID_FILE    = path.join(LOGS_DIR, 'naver-folder.pid');

function ensureLogsDir() { mkdirSync(LOGS_DIR, { recursive: true }); }

function readResult() {
  try {
    if (!existsSync(RESULT_FILE)) return null;
    return JSON.parse(readFileSync(RESULT_FILE, 'utf-8'));
  } catch { return null; }
}

function readPid(): number | null {
  try {
    if (!existsSync(PID_FILE)) return null;
    return parseInt(readFileSync(PID_FILE, 'utf-8').trim()) || null;
  } catch { return null; }
}

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** GET — 상태 + 결과 + 로그 */
export async function GET() {
  const pid     = readPid();
  const running = pid ? isRunning(pid) : false;

  let log = '';
  try {
    if (existsSync(LOG_FILE)) {
      const buf = readFileSync(LOG_FILE);
      log = buf.slice(-80 * 1024).toString('utf-8');
    }
  } catch {}

  return NextResponse.json({ running, pid: running ? pid : null, log, result: readResult() });
}

/** POST — 크롤링 시작 */
export async function POST(req: NextRequest) {
  const { folder_url } = await req.json() as { folder_url?: string };

  if (!folder_url?.includes('map.naver.com')) {
    return NextResponse.json({ error: '올바른 네이버 지도 폴더 URL이 필요합니다' }, { status: 400 });
  }

  const pid = readPid();
  if (pid && isRunning(pid)) {
    return NextResponse.json({ error: '이미 실행 중입니다' }, { status: 409 });
  }

  ensureLogsDir();
  try { writeFileSync(RESULT_FILE, '', 'utf-8'); } catch {}

  const logFd = openSync(LOG_FILE, 'w');
  const child = spawn(TSX_BIN, ['src/naver-folder.ts', `--url=${folder_url.trim()}`], {
    cwd: SCRIPT_DIR,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });
  child.unref();

  writeFileSync(PID_FILE, String(child.pid), 'utf-8');

  return NextResponse.json({ ok: true, pid: child.pid });
}

/** DELETE — 중지 */
export async function DELETE() {
  const pid = readPid();
  if (!pid) return NextResponse.json({ ok: true, killed: false });

  try {
    try { process.kill(-pid, 'SIGTERM'); } catch {}
    try { process.kill(pid, 'SIGTERM'); } catch {}
    try { writeFileSync(PID_FILE, '', 'utf-8'); } catch {}
    return NextResponse.json({ ok: true, killed: true, pid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
