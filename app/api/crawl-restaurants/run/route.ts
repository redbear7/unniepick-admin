import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { openSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { keyword_id, force } = body as { keyword_id?: string; force?: boolean };
  if (!keyword_id) {
    return NextResponse.json({ error: 'keyword_id가 필요합니다' }, { status: 400 });
  }

  // 키워드 존재 확인
  const { data: kw, error: kwErr } = await sb()
    .from('crawl_keywords')
    .select('id, keyword, status, updated_at')
    .eq('id', keyword_id)
    .single();

  if (kwErr || !kw) {
    return NextResponse.json({ error: '키워드를 찾을 수 없습니다' }, { status: 404 });
  }

  // running 상태면서 10분 이상 지났으면 stuck으로 간주하고 재실행 허용
  const stuck = kw.updated_at
    ? Date.now() - new Date(kw.updated_at).getTime() > 10 * 60 * 1000
    : false;

  if (kw.status === 'running' && !force && !stuck) {
    return NextResponse.json({ error: '이미 실행 중입니다 (force: true로 강제 재실행 가능)' }, { status: 409 });
  }

  // 즉시 running 상태로 마킹 (spawn 전에 UI 피드백 즉시 반영)
  await sb()
    .from('crawl_keywords')
    .update({ status: 'running', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', keyword_id);

  // 크롤러 분리 프로세스로 실행
  const scriptDir = path.join(process.cwd(), 'scripts', 'crawl-restaurants');
  const tsxBin = path.join(scriptDir, 'node_modules', '.bin', 'tsx');
  const logPath = path.join(scriptDir, 'logs', `manual-${keyword_id}.log`);

  // 로그 파일 열기 (append)
  const logFd = openSync(logPath, 'a');

  const child = spawn(tsxBin, ['src/main.ts', `--keyword-id=${keyword_id}`], {
    cwd: scriptDir,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });
  child.unref();

  return NextResponse.json({
    ok: true,
    keyword_id,
    keyword: kw.keyword,
    pid: child.pid,
  });
}
