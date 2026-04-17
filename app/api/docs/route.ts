import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const WIKI_ROOT = path.join(process.cwd(), 'docs', 'wiki');

interface DocMeta {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  date: string;
  author: string;
  status: string;
  excerpt: string;
  filePath: string;
}

/** 재귀적으로 .md 파일 수집 */
function walkDocs(dir: string, baseDir: string = dir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDocs(full, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

export async function GET() {
  try {
    const files = walkDocs(WIKI_ROOT);
    const docs: DocMeta[] = [];

    for (const filePath of files) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);

      const relativePath = path.relative(WIKI_ROOT, filePath).replace(/\\/g, '/');
      const slug = relativePath.replace(/\.md$/, '');

      // 카테고리는 frontmatter 우선, 없으면 경로 첫 세그먼트
      const categoryFromPath = relativePath.split('/')[0];

      // 본문에서 첫 단락 추출 (H1 제외)
      const excerpt = content
        .replace(/^#+\s+.+$/gm, '')
        .trim()
        .slice(0, 200)
        .replace(/\n+/g, ' ');

      docs.push({
        slug,
        title: data.title ?? slug,
        category: data.category ?? categoryFromPath,
        tags: Array.isArray(data.tags) ? data.tags : [],
        date: data.date ? String(data.date).slice(0, 10) : '',
        author: data.author ?? '',
        status: data.status ?? '',
        excerpt,
        filePath: relativePath,
      });
    }

    // 최신 날짜 순
    docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 카테고리/태그 집계
    const categories: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    for (const d of docs) {
      categories[d.category] = (categories[d.category] ?? 0) + 1;
      for (const t of d.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }

    return NextResponse.json({
      docs,
      categories: Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      tags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
