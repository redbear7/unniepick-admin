import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const pExec = promisify(exec);

export async function GET() {
  const logPath = path.join(
    process.cwd(), 'scripts', 'crawl-restaurants', 'logs', 'bigdata.log',
  );

  let content = '';
  let exists = false;

  if (fs.existsSync(logPath)) {
    exists = true;
    content = fs.readFileSync(logPath, 'utf-8');
  }

  // Docker 상태 진단 (실시간)
  let diagnosis = '';
  try {
    const { stdout: dockerVersion } = await pExec('docker --version 2>&1', { timeout: 3000 });
    diagnosis += `✓ Docker: ${dockerVersion.trim()}\n`;
  } catch {
    diagnosis += `✗ Docker 명령어 실행 실패 (OrbStack 미실행?)\n`;
  }

  try {
    const { stdout: dockerInfo } = await pExec('docker info 2>&1 | head -5', { timeout: 3000 });
    if (dockerInfo.includes('ERROR')) {
      diagnosis += `✗ Docker daemon 연결 실패\n`;
    } else {
      diagnosis += `✓ Docker daemon 연결됨\n`;
    }
  } catch (e) {
    diagnosis += `✗ Docker daemon 확인 실패: ${(e as Error).message}\n`;
  }

  try {
    const { stdout: psOut } = await pExec(
      'docker ps -a --filter "name=unniepick-" --format "{{.Names}}\\t{{.Status}}"',
      { timeout: 3000 },
    );
    diagnosis += `\n--- 컨테이너 상태 ---\n${psOut || '(없음)'}\n`;
  } catch (e) {
    diagnosis += `\n컨테이너 목록 조회 실패: ${(e as Error).message}\n`;
  }

  return NextResponse.json({
    content,
    exists,
    diagnosis,
    modified: exists ? fs.statSync(logPath).mtime.toISOString() : null,
  });
}
