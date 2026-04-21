/**
 * POST /api/restaurants/batch-extract-tags
 * 전체(또는 지정) 업체 태그 일괄 추출
 *
 * body: { naver_place_ids?: string[] }  — 없으면 전체 처리
 * returns: { ok, processed, failed, skipped, summary }
 *
 * 50건씩 배치 처리 (Supabase 타임아웃 방지)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractTagsV2, type RestaurantForTagging } from '@/lib/tagExtractor';

const BATCH = 50;

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { naver_place_ids?: string[] };
  const sb   = adminSb();

  // 1. 대상 ID 목록 결정
  let ids: string[];
  if (body.naver_place_ids?.length) {
    ids = body.naver_place_ids;
  } else {
    const { data, error } = await sb
      .from('restaurants')
      .select('naver_place_id')
      .order('crawled_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    ids = (data ?? []).map((r: any) => r.naver_place_id);
  }

  if (!ids.length) {
    return NextResponse.json({ ok: true, processed: 0, failed: 0, summary: '처리할 데이터 없음' });
  }

  // 2. 배치 처리
  let processed = 0;
  let failed    = 0;
  const now     = new Date().toISOString();

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);

    // 데이터 조회
    const { data: rows, error: fetchErr } = await sb
      .from('restaurants')
      .select(
        'naver_place_id, name, category, address, business_hours, menu_items, tags, ' +
        'review_keywords, menu_keywords, review_summary, ' +
        'visitor_review_count, is_new_open, instagram_url',
      )
      .in('naver_place_id', chunk);

    if (fetchErr) {
      console.error('[batch-extract-tags] fetch error:', fetchErr.message);
      failed += chunk.length;
      continue;
    }

    // 태그 추출 + 개별 UPDATE
    let chunkProcessed = 0;
    for (const r of (rows ?? [])) {
      const tags = extractTagsV2(r as RestaurantForTagging);
      const tagPayload = {
        tags_v2:         tags,
        tag_source:      'auto',
        tag_confidence:  tags.신뢰도 ?? 0,
        tags_updated_at: now,
      };

      const { error: restErr } = await sb
        .from('restaurants')
        .update(tagPayload)
        .eq('naver_place_id', r.naver_place_id);

      if (restErr) {
        failed++;
        console.error('[batch-extract-tags] update error:', r.naver_place_id, restErr.message);
        continue;
      }

      // stores도 동기화 (존재하는 경우만, 에러 무시)
      await sb
        .from('stores')
        .update(tagPayload)
        .eq('naver_place_id', r.naver_place_id);

      chunkProcessed++;
    }
    processed += chunkProcessed;
  }

  return NextResponse.json({
    ok:        true,
    processed,
    failed,
    total:     ids.length,
    summary:   `총 ${ids.length}건 중 ${processed}건 처리, ${failed}건 실패`,
  });
}
