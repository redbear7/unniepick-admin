import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface ReviewKeyword {
  keyword: string;
  count: number;
}

export interface MenuKeyword {
  menu: string;
  count: number;
}

export interface BlogReview {
  title: string;
  snippet: string;
  date?: string;
}

export interface RestaurantData {
  naver_place_id: string;
  name: string;
  address?: string;
  phone?: string;
  category?: string;
  rating?: number;
  review_count?: number;
  visitor_review_count?: number;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  naver_place_url?: string;
  menu_items?: Array<{ name: string; price?: string }>;
  tags?: string[];
  // 상세 정보 (홈 탭)
  business_hours?: string;          // 영업시간 (예: "월-금 11:00-22:00")
  business_hours_detail?: string;   // 요일별 상세 (JSON 문자열)
  website_url?: string;             // 홈페이지
  instagram_url?: string;           // 인스타그램
  // 리뷰 분석
  review_keywords?: ReviewKeyword[];
  menu_keywords?: MenuKeyword[];
  review_summary?: Record<string, number>;
  blog_reviews?: BlogReview[];
  is_new_open?: boolean;
  auto_tags?: Record<string, string[]>;  // 다차원 자동 태그 { foodType: [], atmosphere: [], ... }
  image_url_original?: string;
}

export interface CrawlKeyword {
  id: string;
  keyword: string;
  description?: string;
  enabled: boolean;
  is_daily: boolean;
  analyze_reviews: boolean;
  status: 'idle' | 'running' | 'success' | 'failed';
  last_error?: string;
  last_result_count?: number;
  last_new_count?: number;
  last_crawled_at?: string;
  current_pid?: number | null;
}

/**
 * 키워드 조회
 * - id가 주어지면 enabled 여부 상관없이 해당 키워드 반환 (수동 실행용)
 * - id가 없으면 enabled=true만 반환 (스케줄러용)
 */
export async function getActiveKeywords(opts: {
  daily?: boolean; id?: string;
} = {}): Promise<CrawlKeyword[]> {
  let query = supabase.from('crawl_keywords').select('*');

  if (opts.id) {
    query = query.eq('id', opts.id);
  } else {
    query = query.eq('enabled', true);
    if (opts.daily) query = query.eq('is_daily', true);
  }

  const { data, error } = await query.order('created_at');
  if (error) {
    console.error('[storage] getActiveKeywords:', error.message);
    return [];
  }
  return (data ?? []) as CrawlKeyword[];
}

/** 키워드 상태 업데이트 (컬럼 누락 대응 자동 재시도) */
export async function updateKeywordStatus(id: string, patch: Partial<CrawlKeyword>): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('crawl_keywords')
    .update({ ...patch, updated_at: now })
    .eq('id', id);

  if (!error) return;

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
    } else {
      console.log('[storage] current_pid 제외 후 재시도 성공');
    }
  }
}

/** 기존 DB에 있는 naver_place_id 목록 조회 (신규 감지용) */
export async function getExistingIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from('restaurants')
    .select('naver_place_id');
  return new Set((data ?? []).map((r) => r.naver_place_id));
}

export async function upsertRestaurants(items: RestaurantData[]): Promise<number> {
  if (!items.length) return 0;

  const rows = items.map((item) => ({
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
  }));

  const { data, error } = await supabase
    .from('restaurants')
    .upsert(rows, { onConflict: 'naver_place_id', ignoreDuplicates: false })
    .select('id');

  if (error) {
    console.error('[storage] upsert error:', error.message);
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
export async function getRestaurantsForVerification(): Promise<Array<{
  id: string; naver_place_id: string; name: string;
  operating_status: string; suspicion_count: number;
}>> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, naver_place_id, name, operating_status, suspicion_count')
    .in('operating_status', ['active', 'suspected', 'unknown'])
    .order('last_verified_at', { ascending: true, nullsFirst: true });

  if (error) {
    console.error('[storage] getRestaurantsForVerification:', error.message);
    return [];
  }
  return (data ?? []) as any;
}

export interface ClosureUpdate {
  operating_status?: 'active' | 'suspected' | 'inactive' | 'relocated' | 'unknown';
  suspicion_count?: number;
  closure_confidence?: number;
  closure_source?: string;
  closed_at?: string;
  last_verified_at?: string;
}

export async function updateClosureStatus(id: string, patch: ClosureUpdate): Promise<void> {
  const { error } = await supabase
    .from('restaurants')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[storage] updateClosureStatus:', error.message);
}
