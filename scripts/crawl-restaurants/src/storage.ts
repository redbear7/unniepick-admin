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
  // 리뷰 분석
  review_keywords?: ReviewKeyword[];
  menu_keywords?: MenuKeyword[];
  review_summary?: Record<string, number>;
  blog_reviews?: BlogReview[];
  is_new_open?: boolean;
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
