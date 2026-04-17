import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const logPath = path.join(
    process.cwd(), 'scripts', 'crawl-restaurants', 'logs', 'verify.log',
  );

  if (!fs.existsSync(logPath)) {
    return NextResponse.json({ content: '', exists: false });
  }

  const stats = fs.statSync(logPath);
  const MAX = 200 * 1024;
  let content: string;

  if (stats.size <= MAX) {
    content = fs.readFileSync(logPath, 'utf-8');
  } else {
    const fd = fs.openSync(logPath, 'r');
    const buf = Buffer.alloc(MAX);
    fs.readSync(fd, buf, 0, MAX, stats.size - MAX);
    fs.closeSync(fd);
    content = '... (앞부분 생략) ...\n' + buf.toString('utf-8');
  }

  return NextResponse.json({
    content,
    exists: true,
    size: stats.size,
    modified: stats.mtime.toISOString(),
  });
}
