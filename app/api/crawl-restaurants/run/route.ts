import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { keyword_id } = await req.json();
  if (!keyword_id) {
    return NextResponse.json({ error: 'keyword_id가 필요합니다' }, { status: 400 });
  }

  // 키워드 존재 확인
  const { data: kw, error: kwErr } = await sb()
    .from('crawl_keywords')
    .select('id, keyword, status')
    .eq('id', keyword_id)
    .single();

  if (kwErr || !kw) {
    return NextResponse.json({ error: '키워드를 찾을 수 없습니다' }, { status: 404 });
  }

  if (kw.status === 'running') {
    return NextResponse.json({ error: '이미 실행 중입니다' }, { status: 409 });
  }

  // 즉시 running 상태로 마킹 (spawn 전에 UI 피드백 즉시 반영)
  await sb()
    .from('crawl_keywords')
    .update({ status: 'running', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', keyword_id);

  // 크롤러 분리 프로세스로 실행
  const scriptDir = path.join(process.cwd(), 'scripts', 'crawl-restaurants');
  const tsxBin = path.join(scriptDir, 'node_modules', '.bin', 'tsx');

  const child = spawn(tsxBin, ['src/main.ts', `--keyword-id=${keyword_id}`], {
    cwd: scriptDir,
    detached: true,
    stdio: 'ignore',
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
