/**
 * POST /api/restaurants/compute-scores
 *
 * discovery_score 일괄 계산 및 업데이트
 *
 * 점수 공식:
 *   파트너 + 활성쿠폰  +1000  (최우선 노출)
 *   파트너 only        +500
 *   블로그 리뷰        +20 × 건수 (최대 +160)
 *   AI 요약            +50
 *   이미지             +30
 *   메뉴               +20
 *   전화번호           +10
 *   영업중             +30
 *   신규오픈           +80
 *   최근 수집(30일)    +20
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST() {
  const sb = adminSb();

  // 1. 파트너 업체 목록 (stores) — naver_place_id 또는 kakao_place_id 기준 매핑
  const { data: storeRows } = await sb
    .from('stores')
    .select('id, naver_place_id, kakao_place_id');

  const partnerNaverIds  = new Set<string>();
  const partnerKakaoIds  = new Set<string>();
  const storeIdMap       = new Map<string, string>(); // naver_place_id → store_id

  for (const s of storeRows ?? []) {
    if (s.naver_place_id) { partnerNaverIds.add(s.naver_place_id); storeIdMap.set(s.naver_place_id, s.id); }
    if (s.kakao_place_id) { partnerKakaoIds.add(s.kakao_place_id); }
  }

  // 2. 활성 쿠폰 보유 store_id 목록
  const now = new Date().toISOString();
  const { data: couponRows } = await sb
    .from('coupons')
    .select('store_id')
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gte.${now}`);

  const storeWithCoupon = new Set<string>((couponRows ?? []).map((c: any) => c.store_id));

  // 3. 전체 restaurants 페이지 순회
  const PAGE = 1000;
  let page = 0;
  let totalUpdated = 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  while (true) {
    const { data, error } = await sb
      .from('restaurants')
      .select('id, naver_place_id, kakao_place_id, phone, image_url, menu_items, ai_summary, blog_reviews, operating_status, tags, crawled_at')
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;

    const patches: { id: string; discovery_score: number }[] = [];

    for (const r of data) {
      let score = 0;

      // 파트너 여부
      const isPartnerByNaver = r.naver_place_id && partnerNaverIds.has(r.naver_place_id);
      const isPartnerByKakao = r.kakao_place_id && partnerKakaoIds.has(r.kakao_place_id);
      const isPartner = isPartnerByNaver || isPartnerByKakao;

      // 쿠폰 여부 (store_id 역참조)
      let hasCoupon = false;
      if (isPartnerByNaver && r.naver_place_id) {
        const storeId = storeIdMap.get(r.naver_place_id);
        if (storeId && storeWithCoupon.has(storeId)) hasCoupon = true;
      }

      if (isPartner && hasCoupon) score += 1000;
      else if (isPartner)         score += 500;

      // 블로그 리뷰 (최대 8건 × 20 = 160)
      const blogCount = Array.isArray(r.blog_reviews) ? r.blog_reviews.length : 0;
      score += Math.min(blogCount * 20, 160);

      // AI 요약
      if (r.ai_summary) score += 50;

      // 이미지
      if (r.image_url) score += 30;

      // 메뉴
      const hasMenu = Array.isArray(r.menu_items) ? r.menu_items.length > 0 : !!r.menu_items;
      if (hasMenu) score += 20;

      // 전화번호
      if (r.phone) score += 10;

      // 영업 상태
      if (r.operating_status === 'active') score += 30;

      // 신규오픈 태그
      const tags = Array.isArray(r.tags) ? r.tags : [];
      if (tags.some((t: string) => t.includes('신규') || t.includes('오픈'))) score += 80;

      // 최근 수집 (30일 이내)
      if (r.crawled_at && r.crawled_at >= thirtyDaysAgo) score += 20;

      patches.push({ id: r.id, discovery_score: score });
    }

    // 배치 업데이트
    const BATCH = 200;
    for (let i = 0; i < patches.length; i += BATCH) {
      const { error: upsertErr } = await sb
        .from('restaurants')
        .upsert(patches.slice(i, i + BATCH), { onConflict: 'id' });
      if (!upsertErr) totalUpdated += Math.min(BATCH, patches.length - i);
    }

    if (data.length < PAGE) break;
    page++;
  }

  return NextResponse.json({ ok: true, updated: totalUpdated });
}
