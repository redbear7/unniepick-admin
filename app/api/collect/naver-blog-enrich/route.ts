/**
 * POST /api/collect/naver-blog-enrich
 * body: { keywords: string[], limit?: number }
 *
 * 네이버 블로그/카페 검색 API로 업체별 리뷰 보강
 * - Playwright 크롤링 없이 공식 API만 사용 (차단 없음)
 * - .env: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 * - SSE(text/event-stream)으로 진행 상황 실시간 전달
 */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface BlogReview {
  title: string;
  snippet: string;
  date: string;
  source: 'blog' | 'cafe';
}

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .trim();
}

async function naverSearch(
  type: 'blog' | 'cafearticle',
  query: string,
  display: number,
  clientId: string,
  clientSecret: string,
): Promise<BlogReview[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://openapi.naver.com/v1/search/${type}.json?query=${encoded}&display=${display}&sort=sim`;

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const source = type === 'blog' ? 'blog' : 'cafe';

  return (data.items ?? []).map((item: Record<string, string>) => ({
    title:   stripHtml(item.title ?? ''),
    snippet: stripHtml(item.description ?? ''),
    date:    item.postdate ?? '',
    source,
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    keywords?: string[];
    limit?: number;
  };

  const keywords: string[] = body.keywords ?? [];
  const limit = Math.min(body.limit ?? 30, 50);

  const clientId     = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 필요' }),
      { status: 500 },
    );
  }

  const sb      = adminSb();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: object) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); }
        catch { closed = true; }
      };

      send({ type: 'start', keywords, limit });

      let totalProcessed = 0;
      let totalErrors    = 0;

      // blog_reviews가 없는 업체를 최근 수집 순으로 조회
      // (태그 방식 대신 — Kakao A안은 tags를 저장하지 않음)
      const { data: rows, error } = await sb
        .from('restaurants')
        .select('id, name, address')
        .or('blog_reviews.is.null,blog_reviews.eq.[]')
        .order('crawled_at', { ascending: false })
        .limit(limit);

      if (error) {
        send({ type: 'log', keyword: 'DB', line: `DB 오류: ${error.message}`, isErr: true });
        send({ type: 'done', processed: 0, errors: 1 });
        closed = true;
        try { controller.close(); } catch {}
        return;
      }

      const restaurants = rows ?? [];
      send({ type: 'keyword', keyword: keywords[0] ?? '', index: 0, total: 1 });
      send({ type: 'log', keyword: keywords[0] ?? '', line: `블로그/카페 리뷰 없는 업체 ${restaurants.length}개 검색 시작` });

      for (let j = 0; j < restaurants.length; j++) {
        if (closed) break;
        const r = restaurants[j];
        send({ type: 'log', keyword: keywords[0] ?? '', line: `[${j + 1}/${restaurants.length}] ${r.name}` });

        try {
          // 지역 힌트: 주소에서 시/구 추출, 없으면 '창원'
          const cityHint = (() => {
            if (!r.address) return '창원';
            const m = r.address.match(/창원[시]?\s?(\S+구|\S+면|\S+동)/);
            return m ? `창원 ${m[1]}` : '창원';
          })();

          // 블로그 5건 + 카페 3건 병렬 조회
          const [blogResults, cafeResults] = await Promise.all([
            naverSearch('blog',        `${r.name} ${cityHint}`, 5, clientId, clientSecret),
            naverSearch('cafearticle', `${r.name} ${cityHint}`, 3, clientId, clientSecret),
          ]);

          const combined: BlogReview[] = [...blogResults, ...cafeResults].slice(0, 8);

          const { error: updateErr } = await sb
            .from('restaurants')
            .update({ blog_reviews: combined })
            .eq('id', r.id);

          if (updateErr) {
            send({ type: 'log', keyword: keywords[0] ?? '', line: `  저장 오류: ${updateErr.message}`, isErr: true });
            totalErrors++;
          } else {
            send({ type: 'log', keyword: keywords[0] ?? '', line: `  ✓ 블로그 ${blogResults.length}건 + 카페 ${cafeResults.length}건` });
            totalProcessed++;
          }
        } catch (e) {
          send({ type: 'log', keyword: keywords[0] ?? '', line: `  오류: ${(e as Error).message}`, isErr: true });
          totalErrors++;
        }

        // 업체 간 딜레이 (API 부하 방지)
        await new Promise(r => setTimeout(r, 250));
      }

      send({ type: 'keyword_done', keyword: keywords[0] ?? '', code: 0 });

      send({ type: 'done', processed: totalProcessed, errors: totalErrors });
      closed = true;
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
