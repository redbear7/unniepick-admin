'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Tag, Hash, Search, X, Loader2, TrendingUp,
  Store, RefreshCw, Sparkles, BarChart3, MapPin,
  Utensils, Clock, Zap, Heart, Shield, DollarSign, ChevronRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* 태그 차원 정의 (tagger.ts와 동기화)                                    */
/* ------------------------------------------------------------------ */

export interface AutoTags {
  foodType:        string[];
  atmosphere:      string[];
  service:         string[];
  facilities:      string[];
  priceRange:      string[];
  mealTime:        string[];
  location:        string[];
  characteristics: string[];
}

type DimKey = keyof AutoTags;

const DIM_META: Record<DimKey, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  foodType:        { label: '음식 유형',   icon: <Utensils   className="w-3.5 h-3.5" />, color: 'text-orange-400',  bg: 'bg-orange-500/10'  },
  atmosphere:      { label: '분위기',      icon: <Heart      className="w-3.5 h-3.5" />, color: 'text-pink-400',    bg: 'bg-pink-500/10'    },
  service:         { label: '서비스',      icon: <Zap        className="w-3.5 h-3.5" />, color: 'text-blue-400',    bg: 'bg-blue-500/10'    },
  facilities:      { label: '편의시설',    icon: <Shield     className="w-3.5 h-3.5" />, color: 'text-teal-400',    bg: 'bg-teal-500/10'    },
  priceRange:      { label: '가격대',      icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-green-400',   bg: 'bg-green-500/10'   },
  mealTime:        { label: '식사시간',    icon: <Clock      className="w-3.5 h-3.5" />, color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
  location:        { label: '지역',        icon: <MapPin     className="w-3.5 h-3.5" />, color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  characteristics: { label: '특징',        icon: <Sparkles   className="w-3.5 h-3.5" />, color: 'text-red-400',     bg: 'bg-red-500/10'     },
};

const DIM_KEYS = Object.keys(DIM_META) as DimKey[];

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface Restaurant {
  id:                   string;
  name:                 string;
  category:             string | null;
  address:              string | null;
  image_url:            string | null;
  visitor_review_count: number;
  custom_tags:          string[];
  auto_tags:            AutoTags | null;
  review_keywords:      Array<{ keyword: string; count: number }>;
  menu_keywords:        Array<{ menu: string; count: number }>;
  operating_status:     string | null;
}

interface DimStat {
  tag:   string;
  count: number;
  dim:   DimKey;
}

/* ------------------------------------------------------------------ */
/* 파싱 헬퍼                                                             */
/* ------------------------------------------------------------------ */

function parseAutoTags(raw: unknown): AutoTags {
  const empty: AutoTags = { foodType: [], atmosphere: [], service: [], facilities: [], priceRange: [], mealTime: [], location: [], characteristics: [] };
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Record<string, unknown>;
  const result: AutoTags = { ...empty };
  for (const k of DIM_KEYS) {
    if (Array.isArray(r[k])) result[k] = r[k] as string[];
  }
  return result;
}

function flatTags(at: AutoTags): string[] {
  return Object.values(at).flat();
}

function getRepTags(r: Restaurant): string[] {
  const custom = r.custom_tags ?? [];
  const auto   = r.auto_tags ? flatTags(r.auto_tags) : [];
  const kw     = (r.review_keywords ?? []).slice(0, 3).map((k) => k.keyword);
  return [...new Set([...custom, ...auto, ...kw])].slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* 통계 집계                                                             */
/* ------------------------------------------------------------------ */

function buildDimStats(restaurants: Restaurant[]): Record<DimKey, DimStat[]> {
  const counters: Record<DimKey, Map<string, number>> = {
    foodType: new Map(), atmosphere: new Map(), service: new Map(),
    facilities: new Map(), priceRange: new Map(), mealTime: new Map(),
    location: new Map(), characteristics: new Map(),
  };

  for (const r of restaurants) {
    if (!r.auto_tags) continue;
    for (const dim of DIM_KEYS) {
      for (const tag of r.auto_tags[dim] ?? []) {
        counters[dim].set(tag, (counters[dim].get(tag) ?? 0) + 1);
      }
    }
    for (const tag of r.custom_tags ?? []) {
      // custom_tags는 characteristics로 분류
      counters.characteristics.set(tag, (counters.characteristics.get(tag) ?? 0) + 1);
    }
  }

  const result = {} as Record<DimKey, DimStat[]>;
  for (const dim of DIM_KEYS) {
    result[dim] = [...counters[dim].entries()]
      .map(([tag, count]) => ({ tag, count, dim }))
      .sort((a, b) => b.count - a.count);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* 메인 페이지                                                           */
/* ------------------------------------------------------------------ */

export default function RestaurantTagsPage() {
  const sb = createClient();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dimStats,    setDimStats]    = useState<Record<DimKey, DimStat[]>>({} as any);
  const [loading,     setLoading]     = useState(true);

  // 필터
  const [search,     setSearch]     = useState('');
  const [dimFilter,  setDimFilter]  = useState<DimKey | null>(null);
  const [tagFilter,  setTagFilter]  = useState('');
  const [viewMode,   setViewMode]   = useState<'list' | 'stats'>('list');

  // 통계용
  const [totalTagged,     setTotalTagged]     = useState(0);
  const [totalAutoTagged, setTotalAutoTagged] = useState(0);
  const [totalTags,       setTotalTags]       = useState(0);

  /* ---- 데이터 로드 ---- */
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb
      .from('restaurants')
      .select('id, name, category, address, image_url, visitor_review_count, custom_tags, auto_tags, review_keywords, menu_keywords, operating_status')
      .neq('operating_status', 'inactive')
      .order('visitor_review_count', { ascending: false })
      .limit(500);

    if (error) { console.error(error); setLoading(false); return; }

    const rows = (data ?? []).map((r: any) => ({
      ...r,
      custom_tags:     Array.isArray(r.custom_tags) ? r.custom_tags : [],
      auto_tags:       parseAutoTags(r.auto_tags),
      review_keywords: (() => { try { return typeof r.review_keywords === 'string' ? JSON.parse(r.review_keywords) : (r.review_keywords ?? []); } catch { return []; } })(),
      menu_keywords:   (() => { try { return typeof r.menu_keywords === 'string' ? JSON.parse(r.menu_keywords) : (r.menu_keywords ?? []); } catch { return []; } })(),
    })) as Restaurant[];

    setRestaurants(rows);

    const stats = buildDimStats(rows);
    setDimStats(stats);

    setTotalTagged(rows.filter((r) => (r.custom_tags?.length ?? 0) > 0 || flatTags(r.auto_tags ?? parseAutoTags(null)).length > 0).length);
    setTotalAutoTagged(rows.filter((r) => r.auto_tags && flatTags(r.auto_tags).length > 0).length);
    setTotalTags(Object.values(stats).reduce((s, arr) => s + arr.length, 0));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ---- 필터 ---- */
  const filtered = restaurants.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.name.toLowerCase().includes(q)
      || (r.category ?? '').toLowerCase().includes(q)
      || (r.address ?? '').includes(q)
      || (r.custom_tags ?? []).some((t) => t.includes(q))
      || (r.auto_tags ? flatTags(r.auto_tags).some((t) => t.includes(q)) : false);

    const matchTag = !tagFilter
      || (r.custom_tags ?? []).includes(tagFilter)
      || (r.auto_tags ? flatTags(r.auto_tags).includes(tagFilter) : false);

    return matchSearch && matchTag;
  });

  /* ---- 렌더 ---- */
  return (
    <div className="space-y-6">

      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#FF6F0F]" />
            업체 태그 관리
          </h1>
          <p className="text-sm text-muted mt-1">
            크롤링 데이터 기반 8차원 자동 태그 시스템 · AI 빅데이터 분석
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'stats' : 'list')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition ${
              viewMode === 'stats'
                ? 'bg-[#FF6F0F] text-white'
                : 'bg-card border border-border-main text-secondary hover:text-primary'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            빅데이터 뷰
          </button>
          <button onClick={loadData} className="p-2 rounded-lg text-muted hover:text-primary hover:bg-fill-subtle" title="새로고침">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 상단 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Hash className="w-4 h-4" />}       label="태그 종류 (차원합계)" value={`${totalTags}개`} />
        <StatCard icon={<Store className="w-4 h-4" />}      label="자동 태그 업체"        value={`${totalAutoTagged}개`}  color="text-[#FF6F0F]" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="태그 있는 업체"        value={`${totalTagged}개`}      color="text-green-400" />
        <StatCard icon={<Tag className="w-4 h-4" />}        label="전체 업체"             value={`${restaurants.length}개`} />
      </div>

      {/* ============================================================ */}
      {/* 빅데이터 뷰                                                     */}
      {/* ============================================================ */}
      {viewMode === 'stats' && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-primary flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#FF6F0F]" />
            8개 차원별 태그 분포
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DIM_KEYS.map((dim) => {
              const meta  = DIM_META[dim];
              const stats = dimStats[dim] ?? [];
              const max   = stats[0]?.count ?? 1;
              return (
                <div key={dim} className="bg-card border border-border-main rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                    <span className={`text-sm font-semibold flex items-center gap-1.5 ${meta.color}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted">{stats.length}개 태그</span>
                  </div>
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {stats.length === 0 ? (
                      <p className="text-xs text-muted text-center py-4">데이터 없음 (크롤링 후 갱신)</p>
                    ) : (
                      stats.map((s) => (
                        <button
                          key={s.tag}
                          onClick={() => { setTagFilter(tagFilter === s.tag ? '' : s.tag); setDimFilter(dim); setViewMode('list'); }}
                          className="w-full flex items-center gap-2 group"
                        >
                          <span className="text-xs text-secondary w-24 text-left truncate group-hover:text-primary transition">{s.tag}</span>
                          <div className="flex-1 bg-fill-subtle rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${(s.count / max) * 100}%`, background: 'var(--color-brand, #FF6F0F)' }}
                            />
                          </div>
                          <span className="text-xs text-muted w-8 text-right">{s.count}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 리스트 뷰                                                       */}
      {/* ============================================================ */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 좌측: 차원 탐색 패널 */}
          <div className="space-y-3">

            {/* 차원 선택 */}
            <div className="bg-card border border-border-main rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle">
                <span className="text-sm font-semibold text-primary">태그 차원 탐색</span>
              </div>
              <div className="p-2 space-y-0.5">
                <button
                  onClick={() => { setDimFilter(null); setTagFilter(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                    !dimFilter ? 'bg-[#FF6F0F]/15 text-[#FF6F0F] font-semibold' : 'text-secondary hover:bg-fill-subtle'
                  }`}
                >
                  <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> 전체</span>
                  <span className="text-xs text-muted">{restaurants.length}</span>
                </button>

                {DIM_KEYS.map((dim) => {
                  const meta  = DIM_META[dim];
                  const stats = dimStats[dim] ?? [];
                  const total = stats.reduce((s, d) => s + d.count, 0);
                  const active = dimFilter === dim;
                  return (
                    <div key={dim}>
                      <button
                        onClick={() => { setDimFilter(active ? null : dim); setTagFilter(''); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                          active ? `${meta.bg} ${meta.color} font-semibold` : 'text-secondary hover:bg-fill-subtle'
                        }`}
                      >
                        <span className={`flex items-center gap-2 ${active ? meta.color : ''}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">{stats.length}종</span>
                          <ChevronRight className={`w-3 h-3 text-muted transition-transform ${active ? 'rotate-90' : ''}`} />
                        </div>
                      </button>

                      {/* 차원 펼쳐진 태그 목록 */}
                      {active && (
                        <div className="ml-2 pl-3 border-l border-border-subtle space-y-0.5 py-1">
                          {stats.slice(0, 15).map((s) => (
                            <button
                              key={s.tag}
                              onClick={() => setTagFilter(tagFilter === s.tag ? '' : s.tag)}
                              className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition ${
                                tagFilter === s.tag
                                  ? `${meta.bg} ${meta.color} font-semibold`
                                  : 'text-muted hover:text-secondary hover:bg-fill-subtle'
                              }`}
                            >
                              <span>#{s.tag}</span>
                              <span className={`px-1.5 py-0.5 rounded-full ${
                                tagFilter === s.tag ? `${meta.bg} ${meta.color}` : 'bg-fill-subtle text-muted'
                              }`}>{s.count}</span>
                            </button>
                          ))}
                          {stats.length > 15 && (
                            <p className="text-[10px] text-muted px-2 pt-1">+{stats.length - 15}개 더</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 우측: 업체 목록 */}
          <div className="lg:col-span-2 space-y-3">

            {/* 검색 */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="업체명, 카테고리, 태그, 주소 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-card border border-border-main rounded-lg text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]"
                />
              </div>
            </div>

            {/* 활성 필터 */}
            {(tagFilter || dimFilter) && (
              <div className="flex items-center gap-2 flex-wrap">
                {dimFilter && (
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${DIM_META[dimFilter].bg} ${DIM_META[dimFilter].color}`}>
                    {DIM_META[dimFilter].icon}
                    {DIM_META[dimFilter].label}
                  </span>
                )}
                {tagFilter && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-[#FF6F0F]/15 text-[#FF6F0F] text-xs rounded-full font-semibold">
                    #{tagFilter}
                    <button onClick={() => setTagFilter('')} className="ml-1 hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <span className="text-xs text-muted">{filtered.length}개 업체</span>
              </div>
            )}

            {/* 업체 카드 목록 */}
            {loading ? (
              <div className="py-20 text-center text-muted">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                로딩 중...
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <RestaurantTagCard
                    key={r.id}
                    restaurant={r}
                    activeDim={dimFilter}
                    activeTag={tagFilter}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="py-16 text-center text-muted">검색 결과가 없습니다</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 업체 태그 카드 (읽기 전용 — 태그 편집은 가게 등록/수정에서)               */
/* ------------------------------------------------------------------ */

function RestaurantTagCard({
  restaurant: r,
  activeDim,
  activeTag,
}: {
  restaurant: Restaurant;
  activeDim:  DimKey | null;
  activeTag:  string;
}) {
  const [expanded, setExpanded] = useState(false);
  const auto = r.auto_tags ?? { foodType: [], atmosphere: [], service: [], facilities: [], priceRange: [], mealTime: [], location: [], characteristics: [] };
  const repTags = getRepTags(r);

  // 강조 대상 차원
  const focusDims = activeDim ? [activeDim] : DIM_KEYS;
  const allFlat   = flatTags(auto);
  const hasAutoTags = allFlat.length > 0;

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition ${
      activeTag && (allFlat.includes(activeTag) || (r.custom_tags ?? []).includes(activeTag))
        ? 'border-[#FF6F0F]/50'
        : 'border-border-main'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {r.image_url ? (
            <img src={r.image_url} alt={r.name} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-fill-subtle flex items-center justify-center flex-shrink-0 text-xl">🍽️</div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-primary text-sm">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.category}
                  {r.address && ` · ${r.address.slice(0, 20)}${r.address.length > 20 ? '...' : ''}`}
                  {' · '}리뷰 {(r.visitor_review_count ?? 0).toLocaleString()}건
                </p>
              </div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-muted hover:text-primary flex-shrink-0 flex items-center gap-1"
              >
                {expanded ? '접기' : '태그 보기'}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* 대표 태그 3개 */}
            <div className="mt-2 flex flex-wrap gap-1">
              {repTags.length > 0 ? (
                repTags.map((tag) => {
                  const isCustom = (r.custom_tags ?? []).includes(tag);
                  const isActive = tag === activeTag;
                  return (
                    <span
                      key={tag}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        isActive
                          ? 'bg-[#FF6F0F] border-[#FF6F0F] text-white'
                          : isCustom
                            ? 'bg-[#FF6F0F]/15 text-[#FF6F0F] border-[#FF6F0F]/30'
                            : 'bg-fill-subtle text-secondary border-border-subtle'
                      }`}
                    >
                      #{tag}
                      {isCustom && <span className="ml-0.5 text-[9px] opacity-60">✎</span>}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-muted italic">
                  {hasAutoTags ? '자동 태그 있음 (아래 보기)' : '태그 없음 (크롤링 필요)'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 펼쳐진 차원별 태그 */}
        {expanded && (
          <div className="mt-4 space-y-3 pt-4 border-t border-border-subtle">
            {/* 자동 태그 (차원별) */}
            {hasAutoTags ? (
              <div className="space-y-2">
                <p className="text-xs text-muted font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  자동 태그 (크롤링 기반)
                </p>
                {focusDims.map((dim) => {
                  const tags = auto[dim];
                  if (!tags?.length) return null;
                  const meta = DIM_META[dim];
                  return (
                    <div key={dim} className="flex items-start gap-2">
                      <span className={`flex items-center gap-1 text-[10px] font-semibold w-16 flex-shrink-0 mt-0.5 ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              tag === activeTag
                                ? 'bg-[#FF6F0F] border-[#FF6F0F] text-white'
                                : `${meta.bg} ${meta.color} border-transparent`
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted text-center py-2">
                자동 태그 없음 — 리뷰 분석 포함하여 재크롤링하면 태그가 자동 부여됩니다
              </p>
            )}

            {/* 커스텀 태그 */}
            {(r.custom_tags ?? []).length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-semibold text-[#FF6F0F] w-16 flex-shrink-0 mt-0.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  커스텀
                </span>
                <div className="flex flex-wrap gap-1">
                  {(r.custom_tags ?? []).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF6F0F]/15 text-[#FF6F0F] border border-[#FF6F0F]/30">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 통계 카드                                                             */
/* ------------------------------------------------------------------ */

function StatCard({ icon, label, value, color = 'text-primary' }: {
  icon: React.ReactNode; label: string; value: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border-main rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
