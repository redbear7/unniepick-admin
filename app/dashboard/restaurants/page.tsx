'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, Star, MapPin, ExternalLink, Clock, X,
  ChevronDown, UtensilsCrossed, Filter, BarChart3,
  MessageSquare, TrendingUp, Tag, Newspaper,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface ReviewKeyword { keyword: string; count: number }
interface MenuKeyword { menu: string; count: number }
interface BlogReview { title: string; snippet: string; date?: string }

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
  review_keywords: ReviewKeyword[];
  menu_keywords: MenuKeyword[];
  review_summary: Record<string, number>;
  blog_reviews: BlogReview[];
  is_new_open: boolean;
  crawled_at: string;
  created_at: string;
}

type SortField = 'visitor_review_count' | 'crawled_at' | 'name';

/** 주소에서 구/동 추출 — 예: "창원 마산합포구 산호동 용마로 96" → { gu: "마산합포구", dong: "산호동" } */
function parseLocation(address: string | null | undefined): { gu: string; dong: string } {
  if (!address) return { gu: '', dong: '' };
  const guMatch = address.match(/[가-힣]+구(?=\s|$)/);
  const dongMatch = address.match(/[가-힣]+(?:동|읍|면)(?=\s|$)/);
  return {
    gu: guMatch?.[0] ?? '',
    dong: dongMatch?.[0] ?? '',
  };
}

/* ------------------------------------------------------------------ */
/* Main Page                                                            */
/* ------------------------------------------------------------------ */

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [guFilter, setGuFilter] = useState('');
  const [dongFilter, setDongFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('visitor_review_count');
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const supabase = createClient();

  useEffect(() => { fetchRestaurants(); }, [sortBy, categoryFilter]);

  async function fetchRestaurants() {
    setLoading(true);
    let query = supabase
      .from('restaurants')
      .select('*')
      .order(sortBy, { ascending: sortBy === 'name' });

    if (categoryFilter) query = query.eq('category', categoryFilter);

    const { data, error } = await query.limit(200);
    if (error) { console.error(error.message); setLoading(false); return; }

    setRestaurants(data ?? []);
    if (!categories.length && data?.length) {
      const cats = [...new Set(data.map((r) => r.category).filter(Boolean))] as string[];
      setCategories(cats.sort());
    }
    setLoading(false);
  }

  // 구/동 옵션 추출
  const { guList, dongList } = (() => {
    const guSet = new Set<string>();
    const dongSet = new Set<string>();
    for (const r of restaurants) {
      const { gu, dong } = parseLocation(r.address);
      if (gu) guSet.add(gu);
      if (dong && (!guFilter || gu === guFilter)) dongSet.add(dong);
    }
    return {
      guList: [...guSet].sort(),
      dongList: [...dongSet].sort(),
    };
  })();

  const filtered = restaurants.filter((r) => {
    const { gu, dong } = parseLocation(r.address);
    if (guFilter && gu !== guFilter) return false;
    if (dongFilter && dong !== dongFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.address?.toLowerCase().includes(q)
      || r.category?.toLowerCase().includes(q) || r.tags?.some((t) => t.includes(q));
  });

  const lastCrawled = restaurants.length
    ? new Date(Math.max(...restaurants.map((r) => new Date(r.crawled_at).getTime())))
    : null;

  // 통계
  const totalReviews = restaurants.reduce((s, r) => s + (r.visitor_review_count ?? 0), 0);
  const avgReviews = restaurants.length ? Math.round(totalReviews / restaurants.length) : 0;
  const newOpenCount = restaurants.filter((r) => r.tags?.includes('창원시 새로오픈 맛집')).length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <UtensilsCrossed className="w-6 h-6" />
          창원 맛집
        </h1>
        <p className="text-sm text-muted mt-1">
          네이버 플레이스 기반 · 총 {restaurants.length}개
          {lastCrawled && <> · 마지막 크롤링: {lastCrawled.toLocaleString('ko-KR')}</>}
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<UtensilsCrossed className="w-4 h-4" />} label="총 업체" value={`${restaurants.length}개`} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="새로오픈" value={`${newOpenCount}개`} color="text-green-400" />
        <StatCard icon={<MessageSquare className="w-4 h-4" />} label="총 리뷰" value={`${totalReviews.toLocaleString()}건`} />
        <StatCard icon={<BarChart3 className="w-4 h-4" />} label="평균 리뷰" value={`${avgReviews}건`} />
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text" placeholder="맛집 이름, 주소, 카테고리 검색..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border-main rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
          />
        </div>
        <SelectFilter
          value={guFilter}
          onChange={(v) => { setGuFilter(v); setDongFilter(''); }}
          options={guList}
          placeholder="전체 구"
          icon={<MapPin className="w-4 h-4" />}
        />
        <SelectFilter
          value={dongFilter}
          onChange={setDongFilter}
          options={dongList}
          placeholder="전체 동"
          icon={<MapPin className="w-4 h-4" />}
        />
        <SelectFilter value={categoryFilter} onChange={setCategoryFilter} options={categories} placeholder="전체 카테고리" icon={<Filter className="w-4 h-4" />} />
        <SelectFilter
          value={sortBy} onChange={(v) => setSortBy(v as SortField)}
          options={[
            { value: 'visitor_review_count', label: '리뷰순' },
            { value: 'crawled_at', label: '최근순' },
            { value: 'name', label: '이름순' },
          ]}
          placeholder="" icon={null}
        />
        {(guFilter || dongFilter || categoryFilter || search) && (
          <button
            onClick={() => { setGuFilter(''); setDongFilter(''); setCategoryFilter(''); setSearch(''); }}
            className="px-3 py-2 text-xs text-muted hover:text-primary hover:bg-fill-subtle rounded-lg"
          >
            초기화
          </button>
        )}
      </div>

      {/* 필터 결과 요약 */}
      {(guFilter || dongFilter || categoryFilter) && (
        <p className="text-xs text-muted">
          필터 적용: {filtered.length}개 / {restaurants.length}개
        </p>
      )}

      {/* 맛집 리스트 */}
      {loading ? (
        <div className="text-center py-20 text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted">{search ? '검색 결과 없음' : '크롤링된 맛집이 없습니다'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <RestaurantCard key={r.id} r={r} onClick={() => setSelected(r)} />
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selected && <DetailModal r={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Components                                                           */
/* ------------------------------------------------------------------ */

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border-main rounded-xl p-4 flex items-center gap-3">
      <div className="text-muted">{icon}</div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className={`text-lg font-bold ${color ?? 'text-primary'}`}>{value}</p>
      </div>
    </div>
  );
}

function SelectFilter({ value, onChange, options, placeholder, icon }: {
  value: string; onChange: (v: string) => void;
  options: string[] | Array<{ value: string; label: string }>;
  placeholder: string; icon: React.ReactNode;
}) {
  const isObj = options.length > 0 && typeof options[0] === 'object';
  return (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className={`${icon ? 'pl-10' : 'pl-4'} pr-8 py-2 bg-card border border-border-main rounded-lg text-sm text-primary appearance-none focus:outline-none focus:border-[#FF6F0F]`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {isObj
          ? (options as Array<{ value: string; label: string }>).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
          : (options as string[]).map((o) => <option key={o} value={o}>{o}</option>)
        }
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
    </div>
  );
}

function RestaurantCard({ r, onClick }: { r: Restaurant; onClick: () => void }) {
  const topKeyword = r.review_keywords?.[0];
  return (
    <div onClick={onClick}
      className="bg-card border border-border-main rounded-xl overflow-hidden hover:border-[#FF6F0F]/50 transition-colors cursor-pointer">
      {r.image_url && (
        <div className="h-36 overflow-hidden bg-fill-subtle">
          <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-primary flex items-center gap-2">
              {r.name}
              {r.is_new_open && <span className="px-1.5 py-0.5 bg-green-500/15 text-green-400 text-[10px] rounded-full border border-green-500/25">NEW</span>}
            </h3>
            {r.category && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded-full border border-blue-500/25">{r.category}</span>
            )}
          </div>
          {r.naver_place_url && (
            <a href={r.naver_place_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted hover:text-primary">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {r.visitor_review_count > 0 && <span className="text-muted">리뷰 {r.visitor_review_count.toLocaleString()}</span>}
          {r.review_count > 0 && <span className="text-muted">블로그 {r.review_count.toLocaleString()}</span>}
        </div>

        {r.address && (
          <div className="flex items-start gap-1.5 text-sm text-muted">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-1">{r.address}</span>
          </div>
        )}

        {/* 1위 키워드 */}
        {topKeyword && (
          <div className="flex items-center gap-1.5 text-xs">
            <MessageSquare className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400">"{topKeyword.keyword}"</span>
            <span className="text-muted">{topKeyword.count}명</span>
          </div>
        )}

        {/* 태그 + 크롤링 날짜 */}
        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex gap-1 flex-wrap">
            {r.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 bg-fill-subtle rounded">#{tag}</span>
            ))}
          </div>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {new Date(r.crawled_at).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail Modal                                                         */
/* ------------------------------------------------------------------ */

function DetailModal({ r, onClose }: { r: Restaurant; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-sidebar border border-border-main rounded-2xl w-full max-w-2xl mx-4 mb-10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        {r.image_url && (
          <div className="h-48 overflow-hidden bg-fill-subtle">
            <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                {r.name}
                {r.is_new_open && <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full">NEW</span>}
              </h2>
              <p className="text-sm text-muted mt-1">{r.category} · 리뷰 {r.visitor_review_count?.toLocaleString()}건</p>
            </div>
            <button onClick={onClose} className="text-muted hover:text-primary"><X className="w-5 h-5" /></button>
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="주소" value={r.address} />
            <Info label="전화" value={r.phone} />
            <Info label="좌표" value={r.latitude && r.longitude ? `${r.latitude}, ${r.longitude}` : null} />
            <Info label="네이버" value={r.naver_place_url ? <a href={r.naver_place_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">바로가기</a> : null} />
          </div>

          {/* 키워드 리뷰 */}
          {r.review_keywords?.length > 0 && (
            <Section title="키워드 리뷰" icon={<MessageSquare className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-2">
                {r.review_keywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1.5 bg-amber-500/10 text-amber-400 text-sm rounded-full border border-amber-500/20">
                    "{kw.keyword}" <span className="text-muted ml-1">{kw.count}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* 메뉴 키워드 */}
          {r.menu_keywords?.length > 0 && (
            <Section title="인기 메뉴" icon={<UtensilsCrossed className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-2">
                {r.menu_keywords.slice(0, 10).map((mk, i) => (
                  <span key={i} className="px-2.5 py-1 bg-fill-subtle text-secondary text-sm rounded">
                    {mk.menu} <span className="text-muted">{mk.count}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* 특징 요약 */}
          {r.review_summary && Object.keys(r.review_summary).length > 0 && (
            <Section title="리뷰 특징" icon={<BarChart3 className="w-4 h-4" />}>
              <div className="space-y-1.5">
                {Object.entries(r.review_summary)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([key, val]) => {
                    const max = Math.max(...Object.values(r.review_summary));
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <span className="w-16 text-muted text-right">{key}</span>
                        <div className="flex-1 h-5 bg-fill-subtle rounded overflow-hidden">
                          <div className="h-full bg-[#FF6F0F]/30 rounded" style={{ width: `${(val / max) * 100}%` }} />
                        </div>
                        <span className="w-8 text-xs text-muted">{val}</span>
                      </div>
                    );
                  })}
              </div>
            </Section>
          )}

          {/* 블로그 리뷰 */}
          {r.blog_reviews?.length > 0 && (
            <Section title="블로그 리뷰" icon={<Newspaper className="w-4 h-4" />}>
              <div className="space-y-3">
                {r.blog_reviews.map((br, i) => (
                  <div key={i} className="bg-fill-subtle rounded-lg p-3">
                    {br.title && <p className="text-sm font-medium text-primary">{br.title}</p>}
                    {br.snippet && <p className="text-xs text-muted mt-1 line-clamp-3">{br.snippet}</p>}
                    {br.date && <p className="text-[10px] text-dim mt-1">{br.date}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 태그 */}
          {r.tags?.length > 0 && (
            <Section title="태그" icon={<Tag className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-fill-subtle text-muted text-xs rounded">#{tag}</span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-secondary flex items-center gap-1.5 mb-2">{icon}{title}</h3>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-primary">{typeof value === 'string' ? value : value}</p>
    </div>
  );
}
