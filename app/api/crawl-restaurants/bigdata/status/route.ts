import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const pExec = promisify(exec);

async function checkContainer(name: string) {
  try {
    const { stdout } = await pExec(
      `docker inspect -f '{{.State.Status}}' ${name} 2>/dev/null`,
    );
    return stdout.trim() || 'absent';
  } catch {
    return 'absent';
  }
}

async function checkHttp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export async function GET() {
  const [metabaseState, directusState] = await Promise.all([
    checkContainer('unniepick-metabase'),
    checkContainer('unniepick-directus'),
  ]);

  // 컨테이너는 running이어도 Metabase는 초기화에 시간이 걸림
  const metabaseReady = metabaseState === 'running'
    ? await checkHttp('http://localhost:3100/api/health')
    : false;
  const directusReady = directusState === 'running'
    ? await checkHttp('http://localhost:8055/server/health')
    : false;

  return NextResponse.json({
    metabase: { state: metabaseState, ready: metabaseReady, url: 'http://localhost:3100' },
    directus: { state: directusState, ready: directusReady, url: 'http://localhost:8055' },
    allReady: metabaseReady && directusReady,
  });
}
