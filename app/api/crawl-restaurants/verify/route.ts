import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync, existsSync, statSync } from 'fs';
import path from 'path';

const VERIFY_LOG = 'verify.log';
const RUNNING_THRESHOLD_MS = 5 * 60 * 1000; // 5분

function logPath() {
  return path.join(process.cwd(), 'scripts', 'crawl-restaurants', 'logs', VERIFY_LOG);
}

/** 상태 조회 */
export async function GET() {
  const p = logPath();
  if (!existsSync(p)) {
    return NextResponse.json({ running: false, exists: false, size: 0 });
  }

  const stats = statSync(p);
  // 5분 이내 로그 갱신이 있으면 실행 중으로 간주
  const running = Date.now() - stats.mtimeMs < RUNNING_THRESHOLD_MS;

  return NextResponse.json({
    running,
    exists: true,
    size: stats.size,
    modified: stats.mtime.toISOString(),
  });
}

/** 검증 실행 */
export async function POST() {
  const scriptDir = path.join(process.cwd(), 'scripts', 'crawl-restaurants');
  const tsxBin = path.join(scriptDir, 'node_modules', '.bin', 'tsx');
  const logFullPath = logPath();

  // 실행 중이면 거부
  if (existsSync(logFullPath)) {
    const stats = statSync(logFullPath);
    if (Date.now() - stats.mtimeMs < RUNNING_THRESHOLD_MS) {
      return NextResponse.json(
        { error: '이미 검증이 진행 중입니다 (5분 이내 로그 갱신됨)' },
        { status: 409 },
      );
    }
  }

  const logFd = openSync(logFullPath, 'w'); // 덮어쓰기

  const child = spawn(tsxBin, ['src/verify.ts'], {
    cwd: scriptDir,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });
  child.unref();

  return NextResponse.json({
    ok: true,
    pid: child.pid,
    logPath: `logs/${VERIFY_LOG}`,
  });
}
