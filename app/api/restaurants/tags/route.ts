/**
 * GET  /api/restaurants/tags          → 전체 태그 통계 (태그명: 업체수)
 * POST /api/restaurants/tags          → 업체에 태그 추가/수정
 *   body: { restaurant_id, tags: string[] }
 * DELETE /api/restaurants/tags        → 전체 태그 일괄 정리 (미사용 태그 삭제)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** GET — 태그 통계 집계 */
export async function GET() {
  const supabase = sb();

  // custom_tags + review_keywords(상위) 통합 통계
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, category, custom_tags, review_keywords, menu_keywords')
    .eq('operating_status', 'active')
    .not('custom_tags', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 태그별 업체 수 집계
  const tagMap = new Map<string, { count: number; restaurants: string[] }>();

  for (const r of restaurants ?? []) {
    const customTags: string[] = r.custom_tags ?? [];

    // 리뷰 키워드 상위 3개를 auto-tag로 포함
    const reviewKws: Array<{ keyword: string; count: number }> = r.review_keywords ?? [];
    const autoTags = reviewKws
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((k) => k.keyword);

    const menuKws: Array<{ menu: string; count: number }> = r.menu_keywords ?? [];
    const menuTags = menuKws
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map((k) => k.menu);

    const allTags = [...new Set([...customTags, ...autoTags, ...menuTags])];

    for (const tag of allTags) {
      if (!tag?.trim()) continue;
      if (!tagMap.has(tag)) tagMap.set(tag, { count: 0, restaurants: [] });
      const entry = tagMap.get(tag)!;
      entry.count++;
      entry.restaurants.push(r.name);
    }
  }

  // 업체수 내림차순 정렬
  const tags = [...tagMap.entries()]
    .map(([tag, { count, restaurants: names }]) => ({
      tag,
      count,
      restaurants: names.slice(0, 5), // 미리보기 5개
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ tags, total: tags.length });
}

/** POST — 특정 업체의 custom_tags 업데이트 */
export async function POST(req: NextRequest) {
  const body = await req.json() as { restaurant_id?: string; tags?: string[] };
  const { restaurant_id, tags } = body;

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id가 필요합니다' }, { status: 400 });
  }

  const cleanedTags = (tags ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 20);

  const { error } = await sb()
    .from('restaurants')
    .update({
      custom_tags: cleanedTags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', restaurant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tags: cleanedTags });
}
