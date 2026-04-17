import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const LOG_DIR = 'scripts/crawl-restaurants/logs';
const LOG_FILE = 'bigdata.log';

export async function POST() {
  const cwd = process.cwd();
  const logDir = path.join(cwd, LOG_DIR);
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const logPath = path.join(logDir, LOG_FILE);
  const logFd = openSync(logPath, 'w'); // 새로 덮어쓰기

  const child = spawn(
    'docker',
    [
      'compose',
      '-f', 'docker-compose.bigdata.yml',
      '--env-file', '.env.bigdata',
      'up', '-d',
    ],
    {
      cwd,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
    },
  );
  child.unref();

  return NextResponse.json({
    ok: true,
    pid: child.pid,
    message: '컨테이너 시작 요청 전송',
    logPath: `${LOG_DIR}/${LOG_FILE}`,
  });
}
