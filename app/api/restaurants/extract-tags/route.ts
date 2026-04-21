/**
 * POST /api/restaurants/extract-tags
 * 단건 태그 추출 + 저장
 *
 * body: { naver_place_id: string }
 * returns: { ok: true, tags: TagsV2 }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractTagsV2, type RestaurantForTagging } from '@/lib/tagExtractor';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const { naver_place_id } = await req.json().catch(() => ({})) as { naver_place_id?: string };
  if (!naver_place_id) {
    return NextResponse.json({ error: 'naver_place_id 필요' }, { status: 400 });
  }

  const sb = adminSb();

  // 1. 원본 데이터 조회
  const { data, error: fetchErr } = await sb
    .from('restaurants')
    .select(
      'name, category, address, business_hours, menu_items, tags, ' +
      'review_keywords, menu_keywords, review_summary, ' +
      'visitor_review_count, is_new_open, instagram_url',
    )
    .eq('naver_place_id', naver_place_id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!data)    return NextResponse.json({ error: '업체 없음' }, { status: 404 });

  // 2. 태그 추출
  const tags = extractTagsV2(data as unknown as RestaurantForTagging);

  // 3. restaurants 저장
  const now = new Date().toISOString();
  const { error: updateErr } = await sb
    .from('restaurants')
    .update({ tags_v2: tags, tag_source: 'auto', tag_confidence: tags.신뢰도, tags_updated_at: now })
    .eq('naver_place_id', naver_place_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // 4. stores에도 동기화 (존재하는 경우)
  await sb
    .from('stores')
    .update({ tags_v2: tags, tag_source: 'auto', tag_confidence: tags.신뢰도, tags_updated_at: now })
    .eq('naver_place_id', naver_place_id);

  return NextResponse.json({ ok: true, tags });
}
