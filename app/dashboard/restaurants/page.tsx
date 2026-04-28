'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, MapPin, ExternalLink, Clock, X,
  ChevronDown, UtensilsCrossed, Filter, BarChart3,
  MessageSquare, TrendingUp, Tag, Newspaper, PlusCircle,
  CheckSquare, Square, Check, Loader2, Pencil,
} from 'lucide-react';
import Link from 'next/link';

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
  custom_tags: string[];
  // 상세 정보
  business_hours: string | null;
  website_url: string | null;
  instagram_url: string | null;
  // 리뷰 분석
  review_keywords: ReviewKeyword[];
  menu_keywords: MenuKeyword[];
  review_summary: Record<string, number>;
  blog_reviews: BlogReview[];
  latitude: number | null;
  longitude: number | null;
  is_new_open: boolean;
  operating_status: 'active' | 'suspected' | 'inactive' | 'relocated' | 'unknown' | null;
  last_verified_at: string | null;
  closed_at: string | null;
  crawled_at: string;
  created_at: string;
  tags_v2: Record<string, unknown> | null;
  tag_confidence: number | null;
  ai_summary: string | null;
  ai_features: {
    분위기태그: string[];
    추천메뉴: string[];
    방문팁: string;
    특징키워드: string[];
  } | null;
  ai_summary_at: string | null;
}

/** 카드에 표기할 대표 태그 3개 (custom_tags 우선, 부족하면 review_keywords 보완) */
function getRepresentativeTags(r: Restaurant): string[] {
  const custom = r.custom_tags ?? [];
  const reviewTop = [...(r.review_keywords ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((k) => k.keyword);
  const menuTop = [...(r.menu_keywords ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((k) => k.menu);
  return [...new Set([...custom, ...reviewTop, ...menuTop].filter(Boolean))].slice(0, 3);
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspected' | 'inactive'>('active');
  const [sortBy, setSortBy] = useState<SortField>('crawled_at');
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  // ── 가게 등록 관련 state ──────────────────────────────────────────
  const [registeredIds,   setRegisteredIds]   = useState<Set<string>>(new Set());
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [bulkRegistering, setBulkRegistering] = useState(false);
  const [registeringId,   setRegisteringId]   = useState<string | null>(null);
  const [registerMsg,     setRegisterMsg]     = useState('');

  // ── 태그 추출 관련 state ──────────────────────────────────────────
  const [tagging,    setTagging]    = useState(false);
  const [tagMsg,     setTagMsg]     = useState('');

  // ── AI 특징 요약 관련 state ───────────────────────────────────────
  const [aiSummarizing,   setAiSummarizing]   = useState(false);
  const [aiSummaryingId,  setAiSummaryingId]  = useState<string | null>(null);
  const [aiMsg,           setAiMsg]           = useState('');

  // ── 무한 스크롤 ───────────────────────────────────────────────
  const COLS        = 3;   // xl:grid-cols-3 기준 1줄 = 3개
  const INITIAL     = 24;  // 초기 표시 (8줄)
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchRestaurants();
    fetchRegisteredIds();
  }, [sortBy, categoryFilter]);

  // 필터/검색 변경 시 visibleCount 리셋
  useEffect(() => {
    setVisibleCount(INITIAL);
  }, [search, categoryFilter, guFilter, dongFilter, statusFilter, sortBy]);

  // IntersectionObserver — sentinel 보이면 1줄(3개) 추가
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + COLS);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 이미 stores에 등록된 naver_place_id 세트 조회
  async function fetchRegisteredIds() {
    const { data } = await supabase
      .from('stores')
      .select('naver_place_id')
      .not('naver_place_id', 'is', null);
    setRegisteredIds(new Set((data ?? []).map((s: any) => s.naver_place_id).filter(Boolean)));
  }

  // 단일 업체 즉시 등록
  async function quickRegister(r: Restaurant) {
    setRegisteringId(r.naver_place_id);
    setRegisterMsg('');
    try {
      const res = await fetch('/api/restaurants/batch-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naver_place_ids: [r.naver_place_id] }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '등록 실패');
      setRegisteredIds(prev => new Set([...prev, r.naver_place_id]));
      setRegisterMsg(`✅ "${r.name}" 가게 등록 완료`);
      setTimeout(() => setRegisterMsg(''), 3000);
    } catch (e) {
      alert(`등록 실패: ${(e as Error).message}`);
    } finally {
      setRegisteringId(null);
    }
  }

  // 체크박스 토글
  function toggleSelect(naverPlaceId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(naverPlaceId) ? next.delete(naverPlaceId) : next.add(naverPlaceId);
      return next;
    });
  }

  // 전체 선택 / 해제
  function toggleSelectAll() {
    const unregistered = filtered
      .filter(r => !registeredIds.has(r.naver_place_id))
      .map(r => r.naver_place_id);
    if (selectedIds.size === unregistered.length && unregistered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unregistered));
    }
  }

  // 선택 업체 일괄 등록
  async function bulkRegister() {
    if (!selectedIds.size) return;
    setBulkRegistering(true);
    setRegisterMsg('');
    try {
      const ids = [...selectedIds];
      const res = await fetch('/api/restaurants/batch-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naver_place_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '등록 실패');
      setRegisteredIds(prev => new Set([...prev, ...data.registered]));
      setSelectedIds(new Set());
      setRegisterMsg(`✅ ${data.registered.length}개 가게 등록 완료${data.failed.length ? ` · ${data.failed.length}개 실패` : ''}`);
      setTimeout(() => setRegisterMsg(''), 4000);
    } catch (e) {
      alert(`일괄 등록 실패: ${(e as Error).message}`);
    } finally {
      setBulkRegistering(false);
    }
  }

  // AI 특징 단건 생성
  async function generateAiSummary(r: Restaurant) {
    setAiSummaryingId(r.naver_place_id);
    try {
      const res  = await fetch('/api/restaurants/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naver_place_id: r.naver_place_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI 요약 실패');
      setRestaurants(prev => prev.map(p =>
        p.naver_place_id === r.naver_place_id
          ? { ...p, ai_summary: data.summary, ai_features: data.features }
          : p,
      ));
    } catch (e) {
      alert(`AI 요약 실패: ${(e as Error).message}`);
    } finally {
      setAiSummaryingId(null);
    }
  }

  // AI 특징 일괄 생성
  async function batchAiSummary() {
    setAiSummarizing(true);
    setAiMsg('');
    try {
      const res  = await fetch('/api/restaurants/batch-ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI 요약 실패');
      setAiMsg(`✨ ${data.processed}개 AI 특징 생성 완료${data.errors ? ` · ${data.errors}개 실패` : ''}`);
      fetchRestaurants();
      setTimeout(() => setAiMsg(''), 5000);
    } catch (e) {
      alert(`AI 요약 실패: ${(e as Error).message}`);
    } finally {
      setAiSummarizing(false);
    }
  }

  // 태그 일괄 추출
  async function batchExtractTags() {
    setTagging(true);
    setTagMsg('');
    try {
      const res  = await fetch('/api/restaurants/batch-extract-tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '태그 추출 실패');
      setTagMsg(`🏷 ${data.summary}`);
      fetchRestaurants();
      setTimeout(() => setTagMsg(''), 5000);
    } catch (e) {
      alert(`태그 추출 실패: ${(e as Error).message}`);
    } finally {
      setTagging(false);
    }
  }

  async function fetchRestaurants() {
    setLoading(true);
    let query = supabase
      .from('restaurants')
      .select('*')
      .order(sortBy, { ascending: sortBy === 'name' });

    if (categoryFilter) query = query.eq('category', categoryFilter);

    const { data, error } = await query.limit(1000);
    if (error) { console.error(error.message); setLoading(false); return; }

    const parseArr = (v: any) => {
      if (Array.isArray(v)) return v;
      try { return JSON.parse(v ?? '[]'); } catch { return []; }
    };
    const parseObj = (v: any) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
      try { return JSON.parse(v ?? '{}'); } catch { return {}; }
    };
    const parsed = (data ?? []).map((r: any) => ({
      ...r,
      menu_items:      parseArr(r.menu_items),
      tags:            parseArr(r.tags),
      custom_tags:     parseArr(r.custom_tags),
      review_keywords: parseArr(r.review_keywords),
      menu_keywords:   parseArr(r.menu_keywords),
      blog_reviews:    parseArr(r.blog_reviews),
      review_summary:  parseObj(r.review_summary),
    }));
    setRestaurants(parsed);
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
      <div className="flex items-start justify-between flex-wrap gap-3">
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI 특징 일괄 생성 */}
          <button
            onClick={batchAiSummary}
            disabled={aiSummarizing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          >
            {aiSummarizing
              ? <><Loader2 className="w-4 h-4 animate-spin" />AI 요약 중...</>
              : <>✨ AI 특징 생성</>
            }
          </button>
          {/* 태그 일괄 추출 */}
          <button
            onClick={batchExtractTags}
            disabled={tagging}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          >
            {tagging
              ? <><Loader2 className="w-4 h-4 animate-spin" />태그 추출 중...</>
              : <><Tag className="w-4 h-4" />태그 일괄 추출</>
            }
          </button>
          <Link
            href="/dashboard/restaurants/register"
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] hover:bg-[#FF6F0F]/90 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            가게 등록
          </Link>
        </div>
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

      {/* AI 요약 완료 메시지 */}
      {aiMsg && (
        <div className="px-4 py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-sm text-emerald-400 font-semibold">
          {aiMsg}
        </div>
      )}

      {/* 태그 추출 완료 메시지 */}
      {tagMsg && (
        <div className="px-4 py-2.5 bg-violet-500/15 border border-violet-500/30 rounded-xl text-sm text-violet-400 font-semibold">
          {tagMsg}
        </div>
      )}

      {/* 등록 완료 메시지 */}
      {registerMsg && (
        <div className="px-4 py-2.5 bg-green-500/15 border border-green-500/30 rounded-xl text-sm text-green-400 font-semibold">
          {registerMsg}
        </div>
      )}

      {/* 맛집 리스트 */}
      {loading ? (
        <div className="text-center py-20 text-muted">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted">{search ? '검색 결과 없음' : '크롤링된 맛집이 없습니다'}</div>
      ) : (
        <>
          {/* 선택 컨트롤 바 */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-muted hover:text-primary transition"
            >
              {selectedIds.size > 0 && selectedIds.size === filtered.filter(r => !registeredIds.has(r.naver_place_id)).length
                ? <CheckSquare className="w-4 h-4 text-[#FF6F0F]" />
                : <Square className="w-4 h-4" />
              }
              {selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : '미등록 전체 선택'}
            </button>
            <p className="text-xs text-muted">
              등록됨 {[...registeredIds].filter(id => filtered.some(r => r.naver_place_id === id)).length}
              / {filtered.length}개
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.slice(0, visibleCount).map((r) => (
              <RestaurantCard
                key={r.id}
                r={r}
                onClick={() => setSelected(r)}
                registered={registeredIds.has(r.naver_place_id)}
                selected={selectedIds.has(r.naver_place_id)}
                onSelect={() => toggleSelect(r.naver_place_id)}
                onAiSummary={() => generateAiSummary(r)}
                aiLoading={aiSummaryingId === r.naver_place_id}
              />
            ))}
          </div>

          {/* 무한 스크롤 sentinel */}
          {visibleCount < filtered.length && (
            <div ref={sentinelRef} className="flex items-center justify-center py-4 text-xs text-muted gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {filtered.length - visibleCount}개 더 있음
            </div>
          )}
        </>
      )}

      {/* 상세 모달 */}
      {selected && (
        <DetailModal
          r={selected}
          onClose={() => setSelected(null)}
          registered={registeredIds.has(selected.naver_place_id)}
        />
      )}

      {/* 일괄 등록 sticky 바 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3.5 bg-sidebar border border-border-main rounded-2xl shadow-2xl">
          <span className="text-sm text-primary font-semibold">
            {selectedIds.size}개 선택됨
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted hover:text-primary transition"
          >
            취소
          </button>
          <button
            onClick={bulkRegister}
            disabled={bulkRegistering}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] hover:bg-[#e85e00] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition"
          >
            {bulkRegistering
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 등록 중...</>
              : <><PlusCircle className="w-4 h-4" /> {selectedIds.size}개 가게 등록</>
            }
          </button>
        </div>
      )}
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

function RestaurantCard({
  r, onClick,
  registered, selected, onSelect,
  onAiSummary, aiLoading,
}: {
  r: Restaurant;
  onClick: () => void;
  registered?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onAiSummary?: () => void;
  aiLoading?: boolean;
}) {
  const topKeyword = r.review_keywords?.[0];
  return (
    <div onClick={onClick}
      className={`bg-card border rounded-xl overflow-hidden transition-colors cursor-pointer relative ${
        selected
          ? 'border-[#FF6F0F] ring-1 ring-[#FF6F0F]/30'
          : 'border-border-main hover:border-[#FF6F0F]/50'
      }`}
    >
      {/* 체크박스 (이미지 위 절대 위치) */}
      {!registered && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          className="absolute top-2 left-2 z-10 w-6 h-6 flex items-center justify-center rounded-md bg-black/50 hover:bg-black/70 transition backdrop-blur-sm"
        >
          {selected
            ? <CheckSquare className="w-4 h-4 text-[#FF6F0F]" />
            : <Square className="w-4 h-4 text-white" />
          }
        </button>
      )}
      {/* 등록됨 배지 */}
      {registered && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-green-500/90 rounded-lg backdrop-blur-sm">
          <Check className="w-3 h-3 text-white" />
          <span className="text-[10px] font-bold text-white">등록됨</span>
        </div>
      )}

      {/* 정사각형 썸네일 */}
      <div className="aspect-square overflow-hidden bg-fill-subtle relative">
        {r.image_url
          ? <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-4xl">
              {r.category?.includes('카페') ? '☕'
               : r.category?.includes('미용') ? '✂️'
               : r.category?.includes('네일') ? '💅'
               : r.category?.includes('편의점') ? '🏪'
               : r.category?.includes('베이커리') || r.category?.includes('빵') ? '🥐'
               : '🍜'}
            </div>
        }
      </div>
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

        {/* 영업시간 */}
        {r.business_hours && (
          <p className="text-xs text-secondary flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted flex-shrink-0" />
            {r.business_hours}
          </p>
        )}

        {/* 인스타 / 홈페이지 */}
        {(r.instagram_url || r.website_url) && (
          <div className="flex gap-2 flex-wrap">
            {r.instagram_url && (
              <a
                href={r.instagram_url} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-pink-400 hover:text-pink-300 flex items-center gap-1"
              >
                📸 인스타그램
              </a>
            )}
            {r.website_url && (
              <a
                href={r.website_url} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                🔗 홈페이지
              </a>
            )}
          </div>
        )}

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

        {/* 대표 태그 3개 + 크롤링 날짜 */}
        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex gap-1 flex-wrap">
            {getRepresentativeTags(r).map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  (r.custom_tags ?? []).includes(tag)
                    ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]'
                    : 'bg-fill-subtle text-secondary'
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 태그 신뢰도 배지 */}
            {r.tags_v2 && r.tag_confidence != null && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/20">
                🏷 {Math.round(r.tag_confidence * 100)}%
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(r.crawled_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>

        {/* AI 특징 요약 */}
        {r.ai_summary ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-2"
          >
            <p className="text-xs font-semibold text-emerald-400 mb-1">✨ AI 특징</p>
            <p className="text-xs text-secondary leading-relaxed">{r.ai_summary}</p>
            {(r.ai_features?.분위기태그?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(r.ai_features?.분위기태그 ?? []).map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full text-[10px] font-semibold">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAiSummary?.(); }}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 mb-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-400 transition disabled:opacity-50"
          >
            {aiLoading
              ? <><Loader2 className="w-3 h-3 animate-spin" />AI 분석 중...</>
              : <>✨ AI 특징 생성</>
            }
          </button>
        )}

        {/* 가게 등록 / 등록됨 버튼 */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {registered ? (
            <>
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-xs font-semibold text-green-400">
                <Check className="w-3.5 h-3.5" />
                가게 등록됨
              </div>
              <Link
                href={`/dashboard/restaurants/register?naver_place_id=${r.naver_place_id}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-fill-subtle hover:bg-fill-medium border border-border-subtle rounded-lg text-xs font-semibold text-muted hover:text-primary transition"
              >
                <Pencil className="w-3 h-3" />
                수정
              </Link>
            </>
          ) : (
            <Link
              href={`/dashboard/restaurants/register?naver_place_id=${r.naver_place_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#FF6F0F] hover:bg-[#e85e00] text-white rounded-lg text-xs font-bold transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              가게 등록
            </Link>
          )}
        </div>

        {/* 네이버 지도 이동 버튼 */}
        {r.naver_place_url && (
          <a
            href={r.naver_place_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-[#03C75A]/10 hover:bg-[#03C75A]/20 border border-[#03C75A]/30 rounded-lg text-xs font-semibold text-[#03C75A] transition"
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

function DetailModal({ r, onClose, registered }: { r: Restaurant; onClose: () => void; registered?: boolean }) {
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
              <h2 className="text-xl font-bold text-primary flex items-center gap-2 flex-wrap">
                {r.name}
                {r.is_new_open && <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full">NEW</span>}
                {registered && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full border border-green-500/25">
                    <Check className="w-3 h-3" /> 등록됨
                  </span>
                )}
              </h2>
              <p className="text-sm text-muted mt-1">{r.category} · 리뷰 {r.visitor_review_count?.toLocaleString()}건</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/restaurants/register?naver_place_id=${r.naver_place_id}`}
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6F0F] hover:bg-[#e85e00] text-white text-xs font-bold rounded-lg transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {registered ? '가게 수정' : '가게 등록'}
              </Link>
              <button onClick={onClose} className="text-muted hover:text-primary"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="주소" value={r.address} />
            <Info label="전화" value={r.phone} />
            {r.business_hours && <Info label="영업시간" value={r.business_hours} className="col-span-2" />}
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
            {r.instagram_url && (
              <a
                href={r.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-lg text-sm font-medium text-pink-400 transition"
              >
                📸 인스타그램
              </a>
            )}
            {r.website_url && (
              <a
                href={r.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-medium text-blue-400 transition"
              >
                🔗 홈페이지
              </a>
            )}
          </div>

          {/* 메뉴판 */}
          {r.menu_items?.length > 0 && (
            <Section title="메뉴판" icon={<UtensilsCrossed className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-1.5">
                {r.menu_items.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-fill-subtle rounded-lg px-3 py-2">
                    <span className="text-sm text-primary font-medium">{m.name}</span>
                    {m.price && <span className="text-xs text-[#FF6F0F] font-semibold">{m.price}</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 키워드 리뷰 */}
          {r.review_keywords?.length > 0 && (
            <Section title="키워드 리뷰" icon={<MessageSquare className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-2">
                {r.review_keywords.filter((kw: any) => kw.keyword?.trim()).map((kw, i) => (
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
                {r.menu_keywords.filter((mk: any) => mk.menu?.trim()).slice(0, 10).map((mk, i) => (
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
            <Section title="크롤링 태그" icon={<Tag className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-fill-subtle text-muted text-xs rounded">#{tag}</span>
                ))}
              </div>
            </Section>
          )}

          {/* 빅데이터 태그 v2 */}
          {r.tags_v2 && Object.keys(r.tags_v2).length > 0 && (
            <Section
              title={`빅데이터 태그 v2${r.tag_confidence != null ? ` · 신뢰도 ${Math.round(r.tag_confidence * 100)}%` : ''}`}
              icon={<span className="text-base">🏷</span>}
            >
              <div className="space-y-2">
                {Object.entries(r.tags_v2)
                  .filter(([k]) => k !== '신뢰도')
                  .map(([cat, val]) => {
                    const values = Array.isArray(val) ? val : [String(val)];
                    const catColors: Record<string, string> = {
                      업종: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
                      세부업종: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
                      메뉴특성: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                      주재료: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
                      요리방식: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
                      가격대: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                      분위기: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
                      방문목적: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
                      동행: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
                      연령대: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
                      운영: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
                      시설: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
                      음식특성: 'bg-green-500/15 text-green-400 border-green-500/25',
                      위치특성: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
                      트렌드: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
                    };
                    const cls = catColors[cat] ?? 'bg-fill-subtle text-muted border-border-subtle';
                    return (
                      <div key={cat} className="flex items-start gap-2">
                        <span className="text-xs text-muted w-16 shrink-0 pt-0.5 text-right">{cat}</span>
                        <div className="flex flex-wrap gap-1">
                          {values.map((v, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
                              {String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-primary">{typeof value === 'string' ? value : value}</p>
    </div>
  );
}
