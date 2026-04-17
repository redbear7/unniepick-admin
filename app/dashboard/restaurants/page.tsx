'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, Star, MapPin, ExternalLink, Clock, X,
  ChevronDown, UtensilsCrossed, Filter, BarChart3,
  MessageSquare, TrendingUp, Tag, Newspaper, Ticket,
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
  operating_status: 'active' | 'suspected' | 'inactive' | 'relocated' | 'unknown' | null;
  last_verified_at: string | null;
  closed_at: string | null;
  crawled_at: string;
  created_at: string;
}

type SortField = 'visitor_review_count' | 'crawled_at' | 'name';

interface MockCoupon {
  title: string;
  discount: string;
  issued_at: string;  // 발급일
}

/**
 * 언니픽 쿠폰 목 데이터 (TODO: 실제 coupons 테이블 연동)
 * naver_place_id 해시 기반으로 결정적 생성 (새로고침해도 동일)
 */
function getMockCoupons(placeId: string): MockCoupon[] {
  const hash = [...placeId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const count = hash % 4;  // 0~3개
  if (count === 0) return [];

  const templates = [
    { title: '첫 방문 20% 할인', discount: '20%', daysAgo: 2 },
    { title: '디저트 1개 무료', discount: '무료', daysAgo: 5 },
    { title: '2인 세트 15% 할인', discount: '15%', daysAgo: 7 },
    { title: '음료 1잔 서비스', discount: '1+1', daysAgo: 12 },
    { title: '주말 런치 3천원 할인', discount: '3,000원', daysAgo: 20 },
  ];

  const coupons: MockCoupon[] = [];
  for (let i = 0; i < count; i++) {
    const t = templates[(hash + i) % templates.length];
    const d = new Date();
    d.setDate(d.getDate() - t.daysAgo);
    coupons.push({
      title: t.title,
      discount: t.discount,
      issued_at: d.toISOString().slice(0, 10),
    });
  }
  // 최신순 정렬
  coupons.sort((a, b) => b.issued_at.localeCompare(a.issued_at));
  return coupons;
}

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspected' | 'inactive'>('active');
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

  // 구/동 옵션 + 카운트 추출
  const { guList, dongList, guCounts, dongCounts } = (() => {
    const guCountMap = new Map<string, number>();
    const dongCountMap = new Map<string, number>();

    for (const r of restaurants) {
      const { gu, dong } = parseLocation(r.address);
      if (gu) guCountMap.set(gu, (guCountMap.get(gu) ?? 0) + 1);
      if (dong && (!guFilter || gu === guFilter)) {
        dongCountMap.set(dong, (dongCountMap.get(dong) ?? 0) + 1);
      }
    }

    return {
      guList: [...guCountMap.keys()].sort((a, b) => (guCountMap.get(b)! - guCountMap.get(a)!)),
      dongList: [...dongCountMap.keys()].sort((a, b) => (dongCountMap.get(b)! - dongCountMap.get(a)!)),
      guCounts: guCountMap,
      dongCounts: dongCountMap,
    };
  })();

  const filtered = restaurants.filter((r) => {
    // 영업 상태 필터 (기본: active + null만 노출, null은 구버전 데이터)
    const status = r.operating_status ?? 'active';
    if (statusFilter === 'active' && status !== 'active') return false;
    if (statusFilter === 'suspected' && status !== 'suspected') return false;
    if (statusFilter === 'inactive' && status !== 'inactive') return false;

    const { gu, dong } = parseLocation(r.address);
    if (guFilter && gu !== guFilter) return false;
    if (dongFilter && dong !== dongFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.address?.toLowerCase().includes(q)
      || r.category?.toLowerCase().includes(q) || r.tags?.some((t) => t.includes(q));
  });

  // 상태별 카운트
  const statusCounts = {
    all: restaurants.length,
    active: restaurants.filter((r) => (r.operating_status ?? 'active') === 'active').length,
    suspected: restaurants.filter((r) => r.operating_status === 'suspected').length,
    inactive: restaurants.filter((r) => r.operating_status === 'inactive').length,
  };

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

      {/* 영업 상태 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        <StatusTab label="영업중" value="active" count={statusCounts.active} current={statusFilter} onClick={setStatusFilter} color="green" />
        <StatusTab label="의심" value="suspected" count={statusCounts.suspected} current={statusFilter} onClick={setStatusFilter} color="amber" />
        <StatusTab label="폐업" value="inactive" count={statusCounts.inactive} current={statusFilter} onClick={setStatusFilter} color="red" />
        <StatusTab label="전체" value="all" count={statusCounts.all} current={statusFilter} onClick={setStatusFilter} color="gray" />
      </div>

      {/* 구별 카드 */}
      {guList.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> 구별 ({guList.length}개)
          </p>
          <div className="flex flex-wrap gap-2">
            {guList.map((gu) => (
              <LocationChip
                key={gu}
                label={gu}
                count={guCounts.get(gu) ?? 0}
                active={guFilter === gu}
                onClick={() => {
                  setGuFilter(guFilter === gu ? '' : gu);
                  setDongFilter('');
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 동별 카드 */}
      {dongList.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            동별 ({dongList.length}개){guFilter && ` · ${guFilter}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {dongList.slice(0, 30).map((dong) => (
              <LocationChip
                key={dong}
                label={dong}
                count={dongCounts.get(dong) ?? 0}
                active={dongFilter === dong}
                onClick={() => setDongFilter(dongFilter === dong ? '' : dong)}
              />
            ))}
          </div>
        </div>
      )}

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

function StatusTab({
  label, value, count, current, onClick, color,
}: {
  label: string;
  value: 'all' | 'active' | 'suspected' | 'inactive';
  count: number;
  current: string;
  onClick: (v: any) => void;
  color: 'green' | 'amber' | 'red' | 'gray';
}) {
  const active = current === value;
  const colorMap = {
    green: active ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'border-green-500/20 text-green-400/70',
    amber: active ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'border-amber-500/20 text-amber-400/70',
    red:   active ? 'bg-red-500/20 border-red-500/50 text-red-400'       : 'border-red-500/20 text-red-400/70',
    gray:  active ? 'bg-fill-subtle border-border-main text-primary'     : 'border-border-subtle text-muted',
  };
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-3 py-1.5 rounded-lg border text-sm transition ${colorMap[color]} hover:opacity-100`}
    >
      {label} <span className="font-bold ml-1">{count}</span>
    </button>
  );
}

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

/** 언니픽 쿠폰 표시 섹션 — 최신 쿠폰 1건 + 총 개수 */
function CouponSection({ placeId }: { placeId: string }) {
  const coupons = getMockCoupons(placeId);

  if (coupons.length === 0) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2.5 bg-fill-subtle/50 border border-border-subtle rounded-lg text-xs text-muted">
        <Ticket className="w-3.5 h-3.5" />
        <span>쿠폰 없음</span>
      </div>
    );
  }

  const latest = coupons[0];
  const days = Math.floor((Date.now() - new Date(latest.issued_at).getTime()) / 86400000);
  const isRecent = days <= 7;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-2 py-2 px-2.5 bg-gradient-to-r from-[#FF6F0F]/10 to-amber-500/5 border border-[#FF6F0F]/30 rounded-lg"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg bg-[#FF6F0F] text-white flex flex-col items-center justify-center leading-none">
        <Ticket className="w-3 h-3 mb-0.5" />
        <span className="text-[10px] font-bold">{latest.discount}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#FF6F0F] truncate">{latest.title}</p>
        <p className="text-[10px] text-muted">
          {isRecent ? <span className="text-green-400 font-semibold">NEW · </span> : null}
          {days === 0 ? '오늘 발급' : `${days}일 전`}
          {coupons.length > 1 && (
            <span className="ml-1.5 px-1 py-0.5 bg-fill-subtle rounded font-semibold">
              +{coupons.length - 1}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-[10px] text-muted text-right">
        쿠폰북<br />
        <span className="font-bold text-[#FF6F0F]">{coupons.length}</span>장
      </div>
    </div>
  );
}

function LocationChip({
  label, count, active, onClick,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm border transition flex items-center gap-1.5 ${
        active
          ? 'bg-[#FF6F0F] border-[#FF6F0F] text-white'
          : 'bg-card border-border-main text-secondary hover:border-[#FF6F0F]/50 hover:text-primary'
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs ${active ? 'text-white/80' : 'text-muted'}`}>
        {count}
      </span>
    </button>
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
            <h3 className="font-semibold text-primary flex items-center gap-2 flex-wrap">
              {r.name}
              {r.is_new_open && <span className="px-1.5 py-0.5 bg-green-500/15 text-green-400 text-[10px] rounded-full border border-green-500/25">NEW</span>}
              {r.operating_status === 'suspected' && (
                <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] rounded-full border border-amber-500/25">🟡 의심</span>
              )}
              {r.operating_status === 'inactive' && (
                <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 text-[10px] rounded-full border border-red-500/25">🔴 폐업</span>
              )}
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

        {/* 언니픽 쿠폰 */}
        <CouponSection placeId={r.naver_place_id} />

        {/* 네이버 지도 이동 버튼 */}
        {r.naver_place_url && (
          <a
            href={r.naver_place_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 flex items-center justify-center gap-1.5 w-full py-2 bg-[#03C75A]/10 hover:bg-[#03C75A]/20 border border-[#03C75A]/30 rounded-lg text-xs font-semibold text-[#03C75A] transition"
          >
            <span className="font-black text-sm">N</span>
            네이버 지도에서 보기
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
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
          </div>

          {/* 외부 링크 버튼 */}
          <div className="flex gap-2 flex-wrap">
            {r.naver_place_url && (
              <a
                href={r.naver_place_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-[#03C75A]/10 hover:bg-[#03C75A]/20 border border-[#03C75A]/30 rounded-lg text-sm font-semibold text-[#03C75A] transition"
              >
                <span className="font-black">N</span>
                네이버 지도에서 보기
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {r.phone && (
              <a
                href={`tel:${r.phone}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-fill-subtle hover:bg-[#FF6F0F]/15 hover:text-[#FF6F0F] border border-border-subtle rounded-lg text-sm font-medium text-secondary transition"
              >
                📞 전화
              </a>
            )}
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
