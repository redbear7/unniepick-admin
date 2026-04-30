import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * 키워드 조회
 * - id가 주어지면 enabled 여부 상관없이 해당 키워드 반환 (수동 실행용)
 * - id가 없으면 enabled=true만 반환 (스케줄러용)
 */
export async function getActiveKeywords(opts = {}) {
    let query = supabase.from('crawl_keywords').select('*');
    if (opts.id) {
        query = query.eq('id', opts.id);
    }
    else {
        query = query.eq('enabled', true);
        if (opts.daily)
            query = query.eq('is_daily', true);
    }
    const { data, error } = await query.order('created_at');
    if (error) {
        console.error('[storage] getActiveKeywords:', error.message);
        return [];
    }
    return (data ?? []);
}
/** 키워드 상태 업데이트 (컬럼 누락 대응 자동 재시도) */
export async function updateKeywordStatus(id, patch) {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('crawl_keywords')
        .update({ ...patch, updated_at: now })
        .eq('id', id);
    if (!error)
        return;
    console.error('[storage] updateKeywordStatus:', error.message);
    // current_pid 컬럼이 없으면 제거 후 재시도
    if (error.message?.includes('current_pid')) {
        const { current_pid, ...safePatch } = patch;
        const retry = await supabase
            .from('crawl_keywords')
            .update({ ...safePatch, updated_at: now })
            .eq('id', id);
        if (retry.error) {
            console.error('[storage] 재시도도 실패:', retry.error.message);
        }
        else {
            console.log('[storage] current_pid 제외 후 재시도 성공');
        }
    }
}
/** 기존 DB에 있는 naver_place_id 목록 조회 (신규 감지용) */
export async function getExistingIds() {
    const { data } = await supabase
        .from('restaurants')
        .select('naver_place_id');
    return new Set((data ?? []).map((r) => r.naver_place_id).filter(Boolean));
}
/** 기존 DB에 있는 kakao_place_id 목록 조회 (카카오 신규 감지용) */
export async function getExistingKakaoIds() {
    const { data } = await supabase
        .from('restaurants')
        .select('kakao_place_id')
        .not('kakao_place_id', 'is', null);
    return new Set((data ?? []).map((r) => r.kakao_place_id).filter(Boolean));
}
function toRow(item) {
    return {
        ...item,
        menu_items: JSON.stringify(item.menu_items ?? []),
        review_keywords: JSON.stringify(item.review_keywords ?? []),
        menu_keywords: JSON.stringify(item.menu_keywords ?? []),
        review_summary: JSON.stringify(item.review_summary ?? {}),
        blog_reviews: JSON.stringify(item.blog_reviews ?? []),
        auto_tags: item.auto_tags ? JSON.stringify(item.auto_tags) : JSON.stringify({}),
        tags: item.tags ?? [],
        naver_verified: !!item.naver_place_url,
        crawled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
export async function upsertRestaurants(items) {
    if (!items.length)
        return 0;
    const { data, error } = await supabase
        .from('restaurants')
        .upsert(items.map(toRow), { onConflict: 'naver_place_id', ignoreDuplicates: false })
        .select('id');
    if (error) {
        console.error('[storage] upsert error:', error.message);
        return 0;
    }
    return data?.length ?? 0;
}
export async function upsertKakaoRestaurants(items) {
    if (!items.length)
        return 0;
    const rows = items.map(item => ({
        ...toRow(item),
        naver_verified: false,
    }));
    const { data, error } = await supabase
        .from('restaurants')
        .upsert(rows, { onConflict: 'kakao_place_id', ignoreDuplicates: false })
        .select('id');
    if (error) {
        console.error('[storage] kakao upsert error:', error.message);
        return 0;
    }
    return data?.length ?? 0;
}
export async function getStats() {
    const { count } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true });
    return { total: count ?? 0 };
}
/** 검증 대상 맛집 조회 (inactive/relocated 제외) */
export async function getRestaurantsForVerification() {
    const { data, error } = await supabase
        .from('restaurants')
        .select('id, naver_place_id, name, operating_status, suspicion_count')
        .in('operating_status', ['active', 'suspected', 'unknown'])
        .order('last_verified_at', { ascending: true, nullsFirst: true });
    if (error) {
        console.error('[storage] getRestaurantsForVerification:', error.message);
        return [];
    }
    return (data ?? []);
}
export async function updateClosureStatus(id, patch) {
    const { error } = await supabase
        .from('restaurants')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error)
        console.error('[storage] updateClosureStatus:', error.message);
}
