import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST() {
  const cwd = process.cwd();

  const child = spawn(
    'docker',
    [
      'compose',
      '-f', 'docker-compose.bigdata.yml',
      '--env-file', '.env.bigdata',
      'down',
    ],
    {
      cwd,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
    },
  );
  child.unref();

  return NextResponse.json({ ok: true, message: '컨테이너 중지 요청 전송' });
}
