import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const WIKI_ROOT = path.join(process.cwd(), 'docs', 'wiki');

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await params;
    const rel = slug.join('/') + '.md';

    // 경로 안전 검증 (상위 디렉토리 접근 차단)
    const filePath = path.join(WIKI_ROOT, rel);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(WIKI_ROOT))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    return NextResponse.json({
      slug: slug.join('/'),
      title: data.title ?? slug[slug.length - 1],
      category: data.category ?? slug[0],
      tags: Array.isArray(data.tags) ? data.tags : [],
      date: data.date ? String(data.date).slice(0, 10) : '',
      author: data.author ?? '',
      status: data.status ?? '',
      content,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
