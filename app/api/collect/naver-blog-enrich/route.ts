/**
 * POST /api/collect/naver-blog-enrich
 * body: { keywords: string[], limit?: number }
 *
 * 네이버 블로그 검색 API로 업체별 리뷰 보강
 * - 상호명 연관성 점수 기반 필터링
 * - .env: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 * - SSE(text/event-stream)으로 진행 상황 실시간 전달
 */
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface BlogReview {
  title:   string;
  snippet: string;
  date:    string;
  source:  'blog' | 'cafe';
  link:    string;
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

/**
 * 상호명에서 핵심 브랜드 토큰 추출
 * "스타비어 창원점" → ["스타비어", "창원점", "스타비어"]  (전체, 지점포함, 핵심)
 * - 마지막 단어가 "점/지점/분점/본점"으로 끝나면 지점 단어로 인식 → 핵심은 나머지
 */
function extractNameTokens(name: string): { full: string; brand: string; words: string[] } {
  const cleaned = name.trim();
  const parts   = cleaned.split(/\s+/);

  // 지점 접미사 패턴
  const branchSuffix = /^.{1,6}(점|지점|분점|본점|직영점|센터)$/;

  let brand = cleaned;
  if (parts.length >= 2 && branchSuffix.test(parts[parts.length - 1])) {
    brand = parts.slice(0, -1).join(' ');
  }

  // 최소 2글자 이상인 단어만 토큰으로 사용
  const words = [...new Set([cleaned, brand, ...parts].filter(w => w.length >= 2))];

  return { full: cleaned, brand, words };
}

/**
 * 연관성 점수 계산
 * 점수 3: 제목에 전체 상호명 포함
 * 점수 2: 제목에 핵심 브랜드명 포함
 * 점수 1: 본문에 핵심 브랜드명 포함
 * 점수 0: 무관 → 제외 대상
 */
function relevanceScore(review: BlogReview, tokens: ReturnType<typeof extractNameTokens>): number {
  const title   = review.title.toLowerCase();
  const snippet = review.snippet.toLowerCase();
  const full    = tokens.full.toLowerCase();
  const brand   = tokens.brand.toLowerCase();

  if (title.includes(full))   return 3;
  if (title.includes(brand))  return 2;
  if (snippet.includes(full)) return 2;
  if (snippet.includes(brand)) return 1;

  // 단어 분리해서 절반 이상 제목에 있으면 1점
  const matchedInTitle = tokens.words.filter(w => title.includes(w.toLowerCase())).length;
  if (matchedInTitle >= Math.ceil(tokens.words.length / 2)) return 1;

  return 0;
}

async function naverSearch(
  query: string,
  display: number,
  clientId: string,
  clientSecret: string,
): Promise<BlogReview[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encoded}&display=${display}&sort=sim`;

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!res.ok) return [];

  const data = await res.json();

  return (data.items ?? []).map((item: Record<string, string>) => ({
    title:   stripHtml(item.title ?? ''),
    snippet: stripHtml(item.description ?? ''),
    date:    item.postdate ?? '',
    link:    item.link ?? '',
    source:  'blog' as const,
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
      send({ type: 'log', keyword: keywords[0] ?? '', line: `블로그 리뷰 없는 업체 ${restaurants.length}개 검색 시작` });

      for (let j = 0; j < restaurants.length; j++) {
        if (closed) break;
        const r = restaurants[j];
        send({ type: 'log', keyword: keywords[0] ?? '', line: `[${j + 1}/${restaurants.length}] ${r.name}` });

        try {
          const cityHint = (() => {
            if (!r.address) return '창원';
            const m = r.address.match(/창원[시]?\s?(\S+구|\S+면|\S+동)/);
            return m ? `창원 ${m[1]}` : '창원';
          })();

          const tokens = extractNameTokens(r.name);

          // 후보 15건 수집 → 연관성 필터 후 상위 8건
          const candidates = await naverSearch(
            `${r.name} ${cityHint}`, 15, clientId, clientSecret,
          );

          // 점수 계산 + 점수 0 제외 + 점수↓ 날짜↓ 정렬
          const scored = candidates
            .map(rv => ({ rv, score: relevanceScore(rv, tokens) }))
            .filter(x => x.score > 0)
            .sort((a, b) =>
              b.score !== a.score
                ? b.score - a.score
                : (b.rv.date > a.rv.date ? 1 : b.rv.date < a.rv.date ? -1 : 0),
            );

          const combined: BlogReview[] = scored.slice(0, 8).map(x => x.rv);

          const skipped  = candidates.length - scored.length;
          const note     = skipped > 0 ? ` (무관 ${skipped}건 제외)` : '';

          const updatePayload: Record<string, unknown> = { blog_reviews: combined };

          const { error: updateErr } = await sb
            .from('restaurants')
            .update(updatePayload)
            .eq('id', r.id);

          if (updateErr) {
            send({ type: 'log', keyword: keywords[0] ?? '', line: `  저장 오류: ${updateErr.message}`, isErr: true });
            totalErrors++;
          } else {
            send({ type: 'log', keyword: keywords[0] ?? '', line: `  ✓ ${combined.length}건 저장${note} → AI 요약 생성 중...` });
            totalProcessed++;

            try {
              const aiRes = await fetch(
                new URL('/api/restaurants/ai-summary', req.url).toString(),
                {
                  method:  'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body:    JSON.stringify({ restaurant_id: r.id }),
                },
              );
              if (aiRes.ok) {
                const aiData = await aiRes.json();
                send({ type: 'log', keyword: keywords[0] ?? '', line: `  ✨ AI 요약: ${aiData.summary?.slice(0, 40) ?? '생성됨'}` });
              } else {
                const err = await aiRes.json().catch(() => ({}));
                send({ type: 'log', keyword: keywords[0] ?? '', line: `  ⚠ AI 요약 실패: ${err.error ?? aiRes.status}`, isErr: true });
              }
            } catch (aiErr) {
              send({ type: 'log', keyword: keywords[0] ?? '', line: `  ⚠ AI 요약 오류: ${(aiErr as Error).message}`, isErr: true });
            }
          }
        } catch (e) {
          send({ type: 'log', keyword: keywords[0] ?? '', line: `  오류: ${(e as Error).message}`, isErr: true });
          totalErrors++;
        }

        await new Promise(r => setTimeout(r, 500));
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
