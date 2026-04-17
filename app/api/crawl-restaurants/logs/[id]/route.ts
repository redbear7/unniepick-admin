import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const logPath = path.join(
    process.cwd(),
    'scripts',
    'crawl-restaurants',
    'logs',
    `manual-${id}.log`,
  );

  if (!fs.existsSync(logPath)) {
    return NextResponse.json({ content: '', exists: false, size: 0 });
  }

  const stats = fs.statSync(logPath);
  // 파일이 너무 크면 뒤에서 200KB만 읽음
  const MAX_READ = 200 * 1024;
  let content: string;

  if (stats.size <= MAX_READ) {
    content = fs.readFileSync(logPath, 'utf-8');
  } else {
    const fd = fs.openSync(logPath, 'r');
    const buffer = Buffer.alloc(MAX_READ);
    fs.readSync(fd, buffer, 0, MAX_READ, stats.size - MAX_READ);
    fs.closeSync(fd);
    content = '... (앞부분 생략) ...\n' + buffer.toString('utf-8');
  }

  return NextResponse.json({
    content,
    exists: true,
    size: stats.size,
    modified: stats.mtime.toISOString(),
  });
}
