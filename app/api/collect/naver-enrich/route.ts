/**
 * POST /api/collect/naver-enrich
 * body: { keywords: string[], limit?: number }
 *
 * 네이버 Playwright 크롤링으로 키워드별 상세 정보 보강
 * (리뷰·영업시간·메뉴·사진 등) — 프록시 + 인간 딜레이 적용
 * SSE(text/event-stream)으로 스크립트 stdout 실시간 전달
 */
import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const CRAWL_DIR = path.resolve(process.cwd(), 'scripts/crawl-restaurants');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    keywords?: string[];
    limit?: number;
  };

  const keywords: string[] = body.keywords ?? [];
  const limit = body.limit ?? 30;

  if (!keywords.length) {
    return new Response(JSON.stringify({ error: 'keywords 필요' }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: 'start', keywords, limit });

      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        send({ type: 'keyword', keyword: kw, index: i, total: keywords.length });

        await new Promise<void>((resolve) => {
          const proc = spawn(
            'npx', ['tsx', 'src/main.ts', `--keyword=${kw}`, `--limit=${limit}`],
            {
              cwd: CRAWL_DIR,
              env: { ...process.env },
              shell: true,
            },
          );

          proc.stdout.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              send({ type: 'log', keyword: kw, line: line.replace(/\x1b\[[0-9;]*m/g, '') });
            }
          });

          proc.stderr.on('data', (chunk: Buffer) => {
            const line = chunk.toString().trim().replace(/\x1b\[[0-9;]*m/g, '');
            if (line) send({ type: 'err', keyword: kw, line });
          });

          proc.on('close', (code) => {
            send({ type: 'keyword_done', keyword: kw, code });
            resolve();
          });
        });

        // 키워드 간 인간적 딜레이 (5~10초)
        if (i < keywords.length - 1) {
          const delay = 5000 + Math.random() * 5000;
          send({ type: 'delay', ms: Math.round(delay) });
          await new Promise(r => setTimeout(r, delay));
        }
      }

      send({ type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
