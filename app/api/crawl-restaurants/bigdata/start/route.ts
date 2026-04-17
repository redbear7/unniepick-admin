import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST() {
  const cwd = process.cwd();

  // docker compose up -d 를 detached로 실행
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
      stdio: 'ignore',
      env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
    },
  );
  child.unref();

  return NextResponse.json({ ok: true, message: '컨테이너 시작 요청 전송' });
}
