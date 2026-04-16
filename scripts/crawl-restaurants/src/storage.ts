import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
}

export async function upsertRestaurants(items: RestaurantData[]): Promise<number> {
  if (!items.length) return 0;

  const rows = items.map((item) => ({
    ...item,
    menu_items: JSON.stringify(item.menu_items ?? []),
    tags: item.tags ?? [],
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
