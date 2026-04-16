'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, Star, MapPin, ExternalLink, Clock,
  ChevronDown, UtensilsCrossed, Filter,
} from 'lucide-react';

interface Restaurant {
  id: string;
  naver_place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  category: string | null;
  rating: number | null;
  review_count: number;
  visitor_review_count: number;
  image_url: string | null;
  naver_place_url: string | null;
  menu_items: Array<{ name: string; price?: string }>;
  tags: string[];
  crawled_at: string;
  created_at: string;
}

type SortField = 'rating' | 'visitor_review_count' | 'crawled_at' | 'name';

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('rating');
  const [categories, setCategories] = useState<string[]>([]);

  const supabase = createClient();

  useEffect(() => {
    fetchRestaurants();
  }, [sortBy, categoryFilter]);

  async function fetchRestaurants() {
    setLoading(true);
    let query = supabase
      .from('restaurants')
      .select('*')
      .order(sortBy, { ascending: sortBy === 'name' });

    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      console.error('맛집 로딩 에러:', error.message);
      setLoading(false);
      return;
    }

    setRestaurants(data ?? []);

    // 카테고리 목록 (첫 로딩 시)
    if (!categories.length && data?.length) {
      const cats = [...new Set(data.map((r) => r.category).filter(Boolean))] as string[];
      setCategories(cats.sort());
    }

    setLoading(false);
  }

  const filtered = restaurants.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.address?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.includes(q))
    );
  });

  const lastCrawled = restaurants.length
    ? new Date(Math.max(...restaurants.map((r) => new Date(r.crawled_at).getTime())))
    : null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6" />
            창원 맛집
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            네이버 플레이스 기반 크롤링 데이터 · 총 {restaurants.length}개
            {lastCrawled && (
              <span className="ml-2">
                · 마지막 크롤링: {lastCrawled.toLocaleString('ko-KR')}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-3">
        {/* 검색 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="맛집 이름, 주소, 카테고리 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 카테고리 필터 */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-blue-500"
          >
            <option value="">전체 카테고리</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>

        {/* 정렬 */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-blue-500 pr-8"
          >
            <option value="rating">평점순</option>
            <option value="visitor_review_count">리뷰순</option>
            <option value="crawled_at">최근 크롤링순</option>
            <option value="name">이름순</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* 맛집 카드 그리드 */}
      {loading ? (
        <div className="text-center py-20 text-neutral-400">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-neutral-400">
          {search ? '검색 결과가 없습니다' : '크롤링된 맛집이 없습니다. 크롤러를 실행해 주세요.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RestaurantCard({ restaurant: r }: { restaurant: Restaurant }) {
  return (
    <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl overflow-hidden hover:border-neutral-600 transition-colors">
      {/* 이미지 */}
      {r.image_url && (
        <div className="h-40 overflow-hidden bg-neutral-900">
          <img
            src={r.image_url}
            alt={r.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* 이름 + 카테고리 */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-white">{r.name}</h3>
            {r.category && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded-full border border-blue-500/25">
                {r.category}
              </span>
            )}
          </div>
          {r.naver_place_url && (
            <a
              href={r.naver_place_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* 평점 + 리뷰 */}
        <div className="flex items-center gap-3 text-sm">
          {r.rating != null && (
            <span className="flex items-center gap-1 text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              {r.rating}
            </span>
          )}
          {r.visitor_review_count > 0 && (
            <span className="text-neutral-400">
              방문자리뷰 {r.visitor_review_count.toLocaleString()}
            </span>
          )}
          {r.review_count > 0 && (
            <span className="text-neutral-400">
              블로그 {r.review_count.toLocaleString()}
            </span>
          )}
        </div>

        {/* 주소 */}
        {r.address && (
          <div className="flex items-start gap-1.5 text-sm text-neutral-400">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{r.address}</span>
          </div>
        )}

        {/* 메뉴 */}
        {r.menu_items?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {r.menu_items.slice(0, 3).map((m, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-neutral-700/50 text-neutral-300 text-xs rounded"
              >
                {m.name}{m.price ? ` ${m.price}` : ''}
              </span>
            ))}
          </div>
        )}

        {/* 태그 + 크롤링 시각 */}
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <div className="flex gap-1">
            {r.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 bg-neutral-700/30 rounded">
                #{tag}
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(r.crawled_at).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>
    </div>
  );
}
