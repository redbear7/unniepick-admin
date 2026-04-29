'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { loadKakaoSDK } from '@/lib/kakaoMap';
import { X, Loader2, ChevronLeft, Search, Sparkles, Clock } from 'lucide-react';
import BlogViewerModal from '@/components/BlogViewerModal';

// ── 시간대별 AI 검색 추천어 ─────────────────────────────────────
function getTimeSuggestions(): { label: string; query: string }[] {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return [
    { label: '☕ 아침 카페',       query: '아침 카페 브런치' },
    { label: '🥐 베이커리',        query: '의창구 베이커리 빵집' },
    { label: '🥗 브런치',          query: '브런치 샐러드 카페' },
    { label: '🎫 쿠폰 카페',       query: '쿠폰 있는 카페' },
    { label: '📍 의창구 아침',     query: '의창구 아침 식사' },
  ];
  if (h >= 11 && h < 14) return [
    { label: '🍚 직장인 점심',     query: '상남동 점심 혼밥' },
    { label: '🍜 국밥·탕',        query: '점심 국밥 탕 찌개' },
    { label: '🍣 일식 점심',      query: '일식 점심 세트' },
    { label: '🎫 쿠폰 맛집',      query: '쿠폰 있는 점심 맛집' },
    { label: '📍 의창구 점심',    query: '의창구 점심 맛집' },
  ];
  if (h >= 14 && h < 18) return [
    { label: '☕ 디저트 카페',     query: '디저트 카페 케이크' },
    { label: '🍡 달달한 간식',    query: '오후 간식 달달한 카페' },
    { label: '🍰 카페 추천',      query: '분위기 좋은 카페' },
    { label: '🎫 쿠폰 카페',      query: '쿠폰 있는 카페' },
    { label: '📍 의창구 카페',    query: '의창구 카페 추천' },
  ];
  if (h >= 18 && h < 22) return [
    { label: '🥩 저녁 고기집',    query: '저녁 고기 구이 회식' },
    { label: '💑 데이트 맛집',    query: '데이트 분위기 좋은 맛집' },
    { label: '🍣 저녁 일식',      query: '저녁 일식 초밥' },
    { label: '🍺 술집·이자카야',  query: '술자리 이자카야 분위기' },
    { label: '📍 의창구 저녁',    query: '의창구 저녁 식사' },
  ];
  return [
    { label: '🍗 야식 치킨',      query: '야식 치킨 배달' },
    { label: '🍺 심야 술집',      query: '야간 술집 포차' },
    { label: '🍜 야식 분식',      query: '야식 떡볶이 분식' },
    { label: '🎫 쿠폰 맛집',      query: '쿠폰 있는 맛집' },
    { label: '📍 의창구 야식',    query: '의창구 야식' },
  ];
}

// ── 타입 ──────────────────────────────────────────────────────
interface BlogReview {
  title:    string;
  snippet?: string;
  date?:    string;
  source?:  'blog' | 'cafe';
  link?:    string;
  featured?: boolean;
}

interface PartnerPin {
  type: 'partner';
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  is_active: boolean;
  lat: number;
  lng: number;
  activeCoupons: number;
  totalCoupons: number;
  naver_place_id: string | null;
  instagram_url: string | null;
  ai_summary: string | null;
}

interface RestaurantPin {
  type: 'restaurant';
  id: string;
  name: string;
  kakao_category: string | null;
  unniepick_category: string | null;
  unniepick_style: string | null;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  kakao_place_url: string | null;
  blog_reviews: BlogReview[];
  instagram_url: string | null;
  ai_summary: string | null;
}

type MapPin = PartnerPin | RestaurantPin;

interface AiResult {
  rank: number;
  restaurant_id: string;
  name: string;
  category: string;
  rating: number | null;
  address: string | null;
  why: string;
  coupon: { title: string; discount: string; description: string } | null;
}

// ── 언니픽 장르(v2) + 용도 설정 ────────────────────────────────
const CATEGORIES = [
  { key: 'all',          label: '전체',       emoji: '🗺️' },
  { key: '카페·디저트',   label: '카페·디저트', emoji: '☕' },
  { key: '한식',          label: '한식',       emoji: '🍚' },
  { key: '고기·구이',     label: '고기·구이',  emoji: '🥩' },
  { key: '치킨·버거',     label: '치킨·버거',  emoji: '🍗' },
  { key: '면류·냉면',     label: '면류·냉면',  emoji: '🍜' },
  { key: '국밥·탕·찌개',  label: '국밥·탕',   emoji: '🍲' },
  { key: '일식·초밥',     label: '일식·초밥',  emoji: '🍣' },
  { key: '해산물·회',     label: '해산물·회',  emoji: '🐟' },
  { key: '양식·파스타',   label: '양식·파스타', emoji: '🍝' },
  { key: '중식',          label: '중식',       emoji: '🥢' },
  { key: '분식·떡볶이',   label: '분식·떡볶이', emoji: '🍢' },
  { key: '베이커리·빵집', label: '베이커리',   emoji: '🥐' },
  { key: '브런치·샐러드', label: '브런치',     emoji: '🥗' },
  { key: '술집·이자카야', label: '술집·이자카야', emoji: '🍺' },
] as const;

const STYLES = [
  { key: 'all',      label: '용도 전체',  emoji: '🍽️' },
  { key: '일반식사',  label: '일반식사',  emoji: '🍽️' },
  { key: '데이트·모임', label: '데이트',  emoji: '💑' },
  { key: '회식·단체', label: '회식·단체', emoji: '👥' },
  { key: '혼밥·간편식', label: '혼밥',   emoji: '🍱' },
  { key: '술자리',    label: '술자리',   emoji: '🍻' },
  { key: '카페·여가', label: '카페·여가', emoji: '☕' },
] as const;

const CATEGORY_COLOR: Record<string, string> = {
  '카페·디저트':  '#7B5EA7',
  '한식':         '#E85D04',
  '고기·구이':    '#C1121F',
  '치킨·버거':    '#F77F00',
  '면류·냉면':    '#4CC9F0',
  '국밥·탕·찌개': '#E63946',
  '일식·초밥':    '#3A86FF',
  '해산물·회':    '#023E8A',
  '양식·파스타':  '#2EC4B6',
  '중식':         '#FB5607',
  '분식·떡볶이':  '#FFBE0B',
  '베이커리·빵집':'#C77DFF',
  '브런치·샐러드':'#52B788',
  '술집·이자카야':'#D62828',
  '기타':         '#6B7280',
};

function getCatColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? '기타'] ?? '#6B7280';
}

const CATEGORY_EMOJI: Record<string, string> = {
  '카페·디저트':  '☕',
  '한식':         '🍚',
  '고기·구이':    '🥩',
  '치킨·버거':    '🍗',
  '면류·냉면':    '🍜',
  '국밥·탕·찌개': '🍲',
  '일식·초밥':    '🍣',
  '해산물·회':    '🐟',
  '양식·파스타':  '🍝',
  '중식':         '🥢',
  '분식·떡볶이':  '🍢',
  '베이커리·빵집':'🥐',
  '브런치·샐러드':'🥗',
  '술집·이자카야':'🍺',
};

function getCatEmoji(cat: string | null) {
  return CATEGORY_EMOJI[cat ?? ''] ?? '🍽️';
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 블로그 사이드 패널 ──────────────────────────────────────────
function BlogPanel({
  pin,
  onClose,
}: {
  pin: MapPin;
  onClose: () => void;
}) {
  const sb = createClient();
  const [reviews,        setReviews]        = useState<BlogReview[]>([]);
  const [reviewSaving,   setReviewSaving]   = useState(false);
  const [loadingBlog,    setLoadingBlog]    = useState(false);
  const [selectedReview, setSelectedReview] = useState<BlogReview | null>(null);
  const [viewerUrl,      setViewerUrl]      = useState<string | null>(null);
  const [viewerTitle,    setViewerTitle]    = useState<string>('');

  const sortedReviews = [...reviews].sort((a, b) => {
    const featDiff = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    if (featDiff !== 0) return featDiff;
    return (b.date ?? '') > (a.date ?? '') ? 1 : (b.date ?? '') < (a.date ?? '') ? -1 : 0;
  });

  useEffect(() => {
    if (pin.type === 'restaurant') {
      setReviews((pin.blog_reviews ?? []).filter(rv => rv.source !== 'cafe'));
    } else {
      if (pin.naver_place_id) {
        setLoadingBlog(true);
        (async () => {
          try {
            const { data } = await sb.from('restaurants')
              .select('blog_reviews')
              .eq('naver_place_id', pin.naver_place_id)
              .maybeSingle();
            if (data?.blog_reviews) {
              try {
                const arr = (Array.isArray(data.blog_reviews)
                  ? data.blog_reviews
                  : JSON.parse(data.blog_reviews)) as BlogReview[];
                setReviews(arr.filter(rv => rv.source !== 'cafe'));
              } catch {}
            }
          } finally {
            setLoadingBlog(false);
          }
        })();
      }
    }
  }, [pin]);

  const persistReviews = async (newReviews: BlogReview[]) => {
    setReviewSaving(true);
    try {
      const body: Record<string, unknown> = { blog_reviews: newReviews };
      if (pin.type === 'restaurant' && pin.id) {
        body.id = pin.id;
      } else if (pin.naver_place_id) {
        body.naver_place_id = pin.naver_place_id;
      } else {
        return;
      }
      const res = await fetch('/api/restaurants/blog-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('blog_reviews 저장 실패:', err.error ?? res.status);
      }
    } finally {
      setReviewSaving(false);
    }
  };

  const deleteReview = async (item: BlogReview) => {
    const newReviews = reviews.filter(r => r !== item);
    setReviews(newReviews);
    await persistReviews(newReviews);
  };

  const toggleFeatured = async (item: BlogReview) => {
    const updated = reviews.map(r => r === item ? { ...r, featured: !r.featured } : r);
    setReviews(updated);
    await persistReviews(updated);
  };

  const cat   = pin.type === 'partner' ? pin.category : pin.unniepick_category;
  const color = getCatColor(cat);

  return (
    <div className="relative flex flex-col h-full" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>

      {/* ── 리뷰 상세 모달 오버레이 ── */}
      {selectedReview && (
        <div className="absolute inset-0 z-20 bg-sidebar flex flex-col">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border-main shrink-0">
            <button
              onClick={() => setSelectedReview(null)}
              className="p-1 rounded text-muted hover:text-primary transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-primary flex-1">블로그 리뷰 상세</span>
            <div className="flex items-center gap-1.5">
              {selectedReview.featured && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400">⭐ 대표</span>
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                selectedReview.source === 'cafe'
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'bg-green-500/15 text-green-400'
              }`}>
                {selectedReview.source === 'cafe' ? '카페' : '블로그'}
              </span>
              {selectedReview.date && (
                <span className="text-[9px] text-dim">
                  {selectedReview.date.slice(0,4)}.{selectedReview.date.slice(4,6)}.{selectedReview.date.slice(6,8)}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <h3 className="text-sm font-bold text-primary leading-relaxed">{selectedReview.title}</h3>
            {selectedReview.snippet && (
              <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">{selectedReview.snippet}</p>
            )}
          </div>
          <div className="px-4 py-3 border-t border-border-main shrink-0">
            <button
              onClick={() => {
                const url = selectedReview.link ||
                  `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(selectedReview.title)}`;
                setViewerUrl(url);
                setViewerTitle(selectedReview.title);
              }}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[#03C75A]/15 text-[#03C75A] text-xs font-semibold hover:bg-[#03C75A]/25 transition"
            >
              {selectedReview.link ? '원문 보기 ↗' : '네이버에서 검색 ↗'}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-start justify-between p-4 border-b border-border-main shrink-0">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {pin.type === 'partner' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: '#FFF3EB', color: '#FF6F0F' }}>파트너</span>
            )}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${color}22`, color }}>
              {cat ?? '미분류'}
            </span>
          </div>
          <h2 className="font-bold text-base text-primary truncate">{pin.name}</h2>
          {pin.address && <p className="text-xs text-muted mt-0.5 truncate">📍 {pin.address}</p>}
        </div>
        <button onClick={onClose} className="text-muted hover:text-primary transition shrink-0 p-1 -mt-1 -mr-1">
          <X size={16} />
        </button>
      </div>

      {/* AI 요약 */}
      <div className="px-4 py-3 border-b border-border-main shrink-0">
        <p className="text-[10px] font-semibold text-muted mb-1">✨ AI 요약</p>
        {pin.ai_summary
          ? <p className="text-xs text-emerald-400 leading-relaxed">{pin.ai_summary}</p>
          : <p className="text-[11px] text-dim">AI 요약 없음</p>
        }
      </div>

      {/* 블로그 리뷰 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[11px] font-semibold text-muted">블로그 리뷰</p>
          {reviewSaving && <Loader2 size={10} className="animate-spin text-muted" />}
        </div>
        {loadingBlog ? (
          <div className="flex items-center gap-2 text-xs text-muted py-2">
            <Loader2 size={12} className="animate-spin" /> 로딩 중...
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-[11px] text-dim">매칭된 블로그 리뷰 없음</p>
        ) : (
          <div className="space-y-2">
            {sortedReviews.map((r, i) => (
              <div
                key={i}
                className={`relative rounded-lg px-3 py-2.5 transition-all border ${
                  r.featured
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-fill-subtle border-border-subtle'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.featured && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400">
                        ⭐ 대표
                      </span>
                    )}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      r.source === 'cafe'
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'bg-green-500/15 text-green-400'
                    }`}>
                      {r.source === 'cafe' ? '카페' : '블로그'}
                    </span>
                    {r.date && <span className="text-[9px] text-dim">{r.date.slice(0, 4)}.{r.date.slice(4, 6)}.{r.date.slice(6, 8)}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => toggleFeatured(r)}
                      title={r.featured ? '대표 해제' : '대표 리뷰로 지정'}
                      className={`p-1 rounded text-[10px] transition-colors ${
                        r.featured
                          ? 'text-amber-400 bg-amber-500/20'
                          : 'text-dim hover:text-amber-400 hover:bg-amber-500/10'
                      }`}
                    >
                      ⭐
                    </button>
                    <button
                      onClick={() => deleteReview(r)}
                      title="리뷰 삭제"
                      className="p-1 rounded text-dim hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
                <div
                  onClick={() => setSelectedReview(r)}
                  className="cursor-pointer"
                >
                  <p className={`text-xs font-medium leading-relaxed ${r.featured ? 'text-amber-300' : 'text-primary'}`}>
                    {r.title}
                  </p>
                  {r.snippet && (
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed line-clamp-2">{r.snippet}</p>
                  )}
                  <p className="text-[10px] text-dim mt-1">탭하여 자세히 보기 →</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewerUrl && (
        <BlogViewerModal
          url={viewerUrl}
          title={viewerTitle}
          onClose={() => setViewerUrl(null)}
        />
      )}
    </div>
  );
}

// ── AI 검색 결과 패널 ────────────────────────────────────────────
function AiResultPanel({
  results,
  searching,
  onSelect,
  onClose,
}: {
  results: AiResult[];
  searching: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-main shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-[#FF6F0F]" />
          <span className="text-xs font-bold text-primary">AI 맛집 추천</span>
          {searching && <Loader2 size={11} className="animate-spin text-[#FF6F0F]" />}
        </div>
        <button onClick={onClose} className="p-1 text-muted hover:text-primary transition">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {results.length === 0 && searching && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted">
            <Loader2 size={18} className="animate-spin" />
            <p className="text-xs">AI가 맛집을 찾고 있어요...</p>
          </div>
        )}
        {results.map(r => (
          <button
            key={r.restaurant_id}
            onClick={() => onSelect(r.restaurant_id)}
            className="w-full text-left rounded-xl border border-border-subtle bg-fill-subtle hover:border-[#FF6F0F]/40 hover:bg-[#FF6F0F]/5 transition-all px-3 py-2.5 group"
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#FF6F0F] text-white text-[10px] font-black flex items-center justify-center mt-0.5">
                {r.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-primary truncate">{r.name}</span>
                  {r.coupon && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#FF6F0F]/15 text-[#FF6F0F] shrink-0">
                      🎫 {r.coupon.discount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted">{r.category}</span>
                  {r.rating && <span className="text-[10px] text-amber-400">★ {r.rating}</span>}
                  {r.address && <span className="text-[10px] text-dim truncate">{r.address}</span>}
                </div>
                <p className="text-[11px] text-secondary mt-1.5 leading-relaxed line-clamp-2">{r.why}</p>
                <p className="text-[10px] text-[#FF6F0F] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  지도에서 보기 →
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────
export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const popupRef     = useRef<any>(null);

  // ── 오버레이 관리 (재빌드 없이 증분 추가) ─────────────────────
  const partnerOvsRef  = useRef<any[]>([]);                              // 파트너 칩
  const restOvMapRef   = useRef<Map<string, { ov: any; pin: RestaurantPin }>>(new Map()); // id → overlay
  const loadedIdsRef   = useRef<Set<string>>(new Set());                 // 뷰포트 캐시
  const fetchingVPRef  = useRef(false);
  const idleTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef        = useRef<number>(7);                              // 현재 줌 레벨 (map 초기 level과 일치)

  // 필터 상태를 ref로도 유지 (클로저에서 최신값 접근)
  const categoryRef    = useRef<string>('all');
  const styleRef       = useRef<string>('all');
  const layerRef       = useRef<'partner' | 'all'>('all');
  const hlIdsRef       = useRef<Set<string>>(new Set());

  const [partners,     setPartners]     = useState<PartnerPin[]>([]);
  const [restaurants,  setRestaurants]  = useState<RestaurantPin[]>([]);  // 뷰포트 누적
  const [loading,      setLoading]      = useState(true);
  const [vpLoading,    setVpLoading]    = useState(false);
  const [mapReady,     setMapReady]     = useState(false);
  const [error,        setError]        = useState('');
  const [category,     setCategory]     = useState<string>('all');
  const [style,        setStyle]        = useState<string>('all');
  const [layer,        setLayer]        = useState<'partner' | 'all'>('all');

  // 블로그 패널
  const [selectedPin,  setSelectedPin]  = useState<MapPin | null>(null);

  // AI 검색
  const [aiQuery,        setAiQuery]        = useState('');
  const [aiSearching,    setAiSearching]    = useState(false);
  const [aiResults,      setAiResults]      = useState<AiResult[]>([]);
  const [aiPanelOpen,    setAiPanelOpen]    = useState(false);
  const [highlightIds,   setHighlightIds]   = useState<Set<string>>(new Set());
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const aiAbortRef    = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const timeSuggestions = useMemo(() => getTimeSuggestions(), []);

  // ref ↔ state 동기화
  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => { styleRef.current = style; }, [style]);
  useEffect(() => { layerRef.current = layer; }, [layer]);
  useEffect(() => { hlIdsRef.current = highlightIds; }, [highlightIds]);

  // ── AI 검색 ───────────────────────────────────────────────────
  const doAiSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    aiAbortRef.current?.abort();
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;

    setAiResults([]);
    setHighlightIds(new Set());
    setAiSearching(true);
    setAiPanelOpen(true);
    setSelectedPin(null);
    setSuggestionOpen(false);

    try {
      const res = await fetch('/api/restaurants/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: ctrl.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'recommendation') {
              const result: AiResult = {
                rank:          ev.rank,
                restaurant_id: ev.restaurant_id,
                name:          ev.name,
                category:      ev.category,
                rating:        ev.rating ?? null,
                address:       ev.address ?? null,
                why:           ev.why,
                coupon:        ev.coupon ? {
                  title:       ev.coupon.title,
                  discount:    ev.coupon.discount,
                  description: ev.coupon.description,
                } : null,
              };
              setAiResults(prev => [...prev, result]);
              setHighlightIds(prev => new Set([...prev, ev.restaurant_id]));
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('[ai-search]', e);
    } finally {
      setAiSearching(false);
    }
  }, []);

  const clearAiSearch = useCallback(() => {
    aiAbortRef.current?.abort();
    setAiResults([]);
    setHighlightIds(new Set());
    setAiPanelOpen(false);
    setAiSearching(false);
    setAiQuery('');
    setSuggestionOpen(false);
  }, []);

  // AI 결과에서 핀 선택 → 지도 이동 + 블로그 패널 열기
  const selectAiResult = useCallback((restaurantId: string) => {
    // restOvMapRef에서 먼저 찾고, 없으면 restaurants state에서 찾음
    const entry = restOvMapRef.current.get(restaurantId);
    const pin   = entry?.pin ?? restaurants.find(r => r.id === restaurantId);
    if (!pin || !mapRef.current) return;
    const kakao = (window as any).kakao;
    if (kakao?.maps) {
      mapRef.current.setCenter(new kakao.maps.LatLng(pin.lat, pin.lng));
      mapRef.current.setLevel(4);
    }
    setSelectedPin(pin);
  }, [restaurants]);

  // ── 파트너 데이터 로드 (최초 1회) ────────────────────────────
  useEffect(() => {
    const sb = createClient();
    (async () => {
      const [{ data: storeData }, { data: couponData }] = await Promise.all([
        sb.from('stores')
          .select('id, name, category, address, is_active, latitude, longitude, naver_place_id, instagram_url, ai_summary')
          .not('latitude', 'is', null).not('longitude', 'is', null),
        sb.from('coupons').select('store_id, is_active, expires_at'),
      ]);
      const now = new Date();
      const couponMap = new Map<string, { total: number; active: number }>();
      (couponData ?? []).forEach((c: any) => {
        const prev = couponMap.get(c.store_id) ?? { total: 0, active: 0 };
        couponMap.set(c.store_id, {
          total:  prev.total + 1,
          active: prev.active + (c.is_active && new Date(c.expires_at) >= now ? 1 : 0),
        });
      });
      setPartners((storeData ?? []).map((s: any) => ({
        type: 'partner', id: s.id, name: s.name, category: s.category,
        address: s.address, is_active: s.is_active,
        lat: s.latitude, lng: s.longitude,
        activeCoupons: couponMap.get(s.id)?.active ?? 0,
        totalCoupons:  couponMap.get(s.id)?.total  ?? 0,
        naver_place_id: s.naver_place_id ?? null,
        instagram_url:  s.instagram_url  ?? null,
        ai_summary:     s.ai_summary     ?? null,
      })));
      setLoading(false);
    })();
  }, []);

  // ── 팝업 ────────────────────────────────────────────────────────
  const closePopup = useCallback(() => {
    popupRef.current?.setMap(null);
    popupRef.current = null;
  }, []);

  // ── row → RestaurantPin 변환 ────────────────────────────────────
  const toRestPin = useCallback((r: any): RestaurantPin => {
    let blogReviews: BlogReview[] = [];
    try {
      blogReviews = Array.isArray(r.blog_reviews)
        ? r.blog_reviews
        : JSON.parse(r.blog_reviews ?? '[]');
    } catch {}
    return {
      type: 'restaurant', id: r.id, name: r.name,
      kakao_category: r.kakao_category,
      unniepick_category: r.unniepick_category,
      unniepick_style: r.unniepick_style ?? null,
      address: r.address, phone: r.phone,
      lat: r.latitude, lng: r.longitude,
      kakao_place_url: r.kakao_place_url,
      blog_reviews: blogReviews,
      instagram_url: r.instagram_url ?? null,
      ai_summary:    r.ai_summary    ?? null,
    };
  }, []);

  // ── 수집 업체 오버레이 생성 (줌 레벨 반영) ───────────────────
  const makeRestOverlay = useCallback((kakao: any, pin: RestaurantPin, hlIds: Set<string>, zoom?: number) => {
    const isHL    = hlIds.has(pin.id);
    const color   = getCatColor(pin.unniepick_category);
    const emoji   = getCatEmoji(pin.unniepick_category);
    const hasBlog = pin.blog_reviews.length > 0;
    const lv      = zoom ?? zoomRef.current;

    // AI 추천 핀 — 항상 풀 칩
    if (isHL) {
      const html =
        `<div onclick="window.__mapPinClick('${pin.id}','restaurant')" ` +
        `style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">` +
          `<div style="display:flex;align-items:center;gap:3px;background:#FF6F0F;border-radius:16px;` +
          `padding:3px 9px;box-shadow:0 2px 10px rgba(255,111,15,0.55);` +
          `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
            `<span style="font-size:10px;">✨</span>` +
            `<span style="font-size:11px;font-weight:800;color:#fff;white-space:nowrap;` +
            `max-width:90px;overflow:hidden;text-overflow:ellipsis;">${esc(pin.name)}</span>` +
          `</div>` +
          `<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;` +
          `border-top:7px solid #FF6F0F;margin-top:-1px;"></div>` +
        `</div>`;
      return new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(pin.lat, pin.lng), content: html, yAnchor: 1, zIndex: 9 });
    }

    // 레벨 8+ (시 전체 뷰) — 이모지 원형 도트만 표시 (너무 밀집)
    // 레벨 7: 구 단위 — 짧은 상호명
    // 레벨 5~6: 동 단위 — 상호명
    // 레벨 ≤4: 거리 단위 — 전체 상호명
    if (lv >= 8) {
      const blogDot = hasBlog
        ? `<div style="position:absolute;top:-2px;right:-2px;width:6px;height:6px;border-radius:50%;` +
          `background:#22C55E;border:1px solid #fff;"></div>`
        : '';
      const html =
        `<div onclick="window.__mapPinClick('${pin.id}','restaurant')" ` +
        `style="position:relative;width:22px;height:22px;border-radius:50%;` +
        `background:#fff;border:2px solid ${color};` +
        `display:flex;align-items:center;justify-content:center;` +
        `box-shadow:0 1px 4px rgba(0,0,0,0.18);cursor:pointer;font-size:11px;">` +
          `${emoji}${blogDot}` +
        `</div>`;
      return new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(pin.lat, pin.lng), content: html, zIndex: 3 });
    }

    // 레벨 7 → 5자, 레벨 5~6 → 7자, 레벨 ≤4 → 전체 상호명
    const maxLen = lv >= 7 ? 5 : lv >= 5 ? 7 : 14;
    const displayName = pin.name.length > maxLen ? pin.name.slice(0, maxLen) + '…' : pin.name;
    const blogDot = hasBlog
      ? `<div style="width:5px;height:5px;border-radius:50%;background:#22C55E;flex-shrink:0;"></div>`
      : '';
    const borderWidth = hasBlog ? '2px' : '1.5px';
    const html =
      `<div onclick="window.__mapPinClick('${pin.id}','restaurant')" ` +
      `style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">` +
        `<div style="display:flex;align-items:center;gap:3px;` +
        `background:rgba(255,255,255,0.96);border-radius:12px;` +
        `border:${borderWidth} solid ${color};` +
        `padding:2px 6px 2px 4px;` +
        `box-shadow:0 1px 4px rgba(0,0,0,0.15);` +
        `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
          `<span style="font-size:11px;line-height:1;">${emoji}</span>` +
          `<span style="font-size:10px;font-weight:600;color:#111;white-space:nowrap;">${esc(displayName)}</span>` +
          `${blogDot}` +
        `</div>` +
        `<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;` +
        `border-top:5px solid ${color};margin-top:-1px;"></div>` +
      `</div>`;
    return new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(pin.lat, pin.lng), content: html, yAnchor: 1, zIndex: hasBlog ? 5 : 3 });
  }, []);

  // ── 파트너 칩 재빌드 ────────────────────────────────────────────
  const rebuildPartners = useCallback((kakao: any, map: any, pts: PartnerPin[], cat: string) => {
    partnerOvsRef.current.forEach(o => o.setMap(null));
    partnerOvsRef.current = [];
    pts.filter(p => cat === 'all' || p.category === cat).forEach(p => {
      const color   = p.activeCoupons > 0 ? '#FF6F0F' : p.is_active ? '#22C55E' : '#4B5563';
      const hasBlog = !!(p.naver_place_id || p.instagram_url);
      const badge   = p.activeCoupons > 0
        ? `<span style="background:#FF6F0F;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:800;">${p.activeCoupons}</span>`
        : '';
      const blogIcon = hasBlog ? `<span style="font-size:10px;margin-left:2px;">📝</span>` : '';
      const html =
        `<div onclick="window.__mapPinClick('${p.id}','partner')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">` +
          `<div style="display:flex;align-items:center;gap:4px;background:#fff;border-radius:20px;` +
          `border:2.5px solid ${color};padding:4px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.2);` +
          `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
            `<span style="font-size:11px;font-weight:800;color:${color};white-space:nowrap;` +
            `overflow:hidden;text-overflow:ellipsis;max-width:110px;">${esc(p.name)}</span>${badge}${blogIcon}` +
          `</div>` +
          `<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;` +
          `border-top:7px solid ${color};margin-top:-1px;"></div>` +
        `</div>`;
      const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: html, yAnchor: 1, zIndex: 10 });
      ov.setMap(map);
      partnerOvsRef.current.push(ov);
    });
  }, []);

  // ── 가시성 판단 헬퍼 ────────────────────────────────────────────
  const isVisible = useCallback((pin: RestaurantPin, lyr: string, cat: string, sty: string) =>
    lyr === 'all'
    && (cat === 'all' || pin.unniepick_category === cat)
    && (sty === 'all' || pin.unniepick_style === sty),
  []);

  // ── 새 수집업체 오버레이 추가 (증분) ───────────────────────────
  const addRestOverlays = useCallback((kakao: any, map: any, newPins: RestaurantPin[], cat: string, lyr: string, sty: string, hlIds: Set<string>, zoom?: number) => {
    const lv = zoom ?? zoomRef.current;
    newPins.forEach(pin => {
      const ov = makeRestOverlay(kakao, pin, hlIds, lv);
      ov.setMap(isVisible(pin, lyr, cat, sty) ? map : null);
      restOvMapRef.current.set(pin.id, { ov, pin });
    });
  }, [makeRestOverlay, isVisible]);

  // ── 필터 변경 시 기존 오버레이 show/hide ───────────────────────
  const applyRestFilter = useCallback((map: any, cat: string, lyr: string, sty: string) => {
    for (const [, entry] of restOvMapRef.current) {
      entry.ov.setMap(isVisible(entry.pin, lyr, cat, sty) ? map : null);
    }
  }, [isVisible]);

  // ── AI 하이라이트 변경: 해당 핀만 재생성 ──────────────────────
  const applyHighlight = useCallback((kakao: any, map: any, hlIds: Set<string>, lyr: string, cat: string, sty: string) => {
    for (const [id, entry] of restOvMapRef.current) {
      const wasHL = entry.ov.getZIndex?.() === 8;
      const isHL  = hlIds.has(id);
      if (wasHL !== isHL) {
        entry.ov.setMap(null);
        const newOv = makeRestOverlay(kakao, entry.pin, hlIds);
        newOv.setMap(isVisible(entry.pin, lyr, cat, sty) ? map : null);
        restOvMapRef.current.set(id, { ov: newOv, pin: entry.pin });
      }
    }
  }, [makeRestOverlay, isVisible]);

  // ── 줌 변경 시 수집업체 오버레이 재생성 ───────────────────────
  const refreshRestOverlays = useCallback((kakao: any, map: any) => {
    const zoom = map.getLevel();
    zoomRef.current = zoom;
    const cat = categoryRef.current;
    const lyr = layerRef.current;
    const sty = styleRef.current;
    const hls = hlIdsRef.current;
    for (const [id, entry] of restOvMapRef.current) {
      entry.ov.setMap(null);
      const newOv = makeRestOverlay(kakao, entry.pin, hls, zoom);
      newOv.setMap(isVisible(entry.pin, lyr, cat, sty) ? map : null);
      restOvMapRef.current.set(id, { ov: newOv, pin: entry.pin });
    }
  }, [makeRestOverlay, isVisible]);

  // ── 뷰포트 기반 수집업체 fetch ─────────────────────────────────
  const fetchViewport = useCallback(async (map: any) => {
    if (fetchingVPRef.current) return;
    fetchingVPRef.current = true;
    setVpLoading(true);
    try {
      const sb     = createClient();
      const bounds = map.getBounds();
      const sw     = bounds.getSouthWest();
      const ne     = bounds.getNorthEast();
      // 뷰포트보다 약간 넓게 (20%) 미리 로드
      const latPad = (ne.getLat() - sw.getLat()) * 0.2;
      const lngPad = (ne.getLng() - sw.getLng()) * 0.2;

      const { data } = await sb.from('restaurants')
        .select('id, name, kakao_category, unniepick_category, unniepick_style, address, phone, latitude, longitude, kakao_place_url, blog_reviews, instagram_url, ai_summary')
        .gte('latitude',  sw.getLat() - latPad)
        .lte('latitude',  ne.getLat() + latPad)
        .gte('longitude', sw.getLng() - lngPad)
        .lte('longitude', ne.getLng() + lngPad)
        .not('latitude', 'is', null);

      const newRows = (data ?? []).filter(r => !loadedIdsRef.current.has(r.id));
      if (newRows.length > 0) {
        newRows.forEach(r => loadedIdsRef.current.add(r.id));
        const kakao      = (window as any).kakao;
        const newPins    = newRows.map(toRestPin);
        const currentZoom = map.getLevel();          // 항상 실시간 줌 레벨 사용
        addRestOverlays(kakao, map, newPins, categoryRef.current, layerRef.current, styleRef.current, hlIdsRef.current, currentZoom);
        setRestaurants(prev => [...prev, ...newPins]);
      }
    } catch (e) {
      console.error('[fetchViewport]', e);
    } finally {
      fetchingVPRef.current = false;
      setVpLoading(false);
    }
  }, [toRestPin, addRestOverlays]);

  // ── 카카오맵 초기화 ────────────────────────────────────────────
  useEffect(() => {
    if (loading || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await loadKakaoSDK();
        if (cancelled || !containerRef.current) return;
        const kakao = (window as any).kakao;
        const map   = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(35.2285, 128.6811),
          level: 7,
        });
        mapRef.current = map;

        // 핀 클릭 전역 핸들러 등록
        (window as any).__mapPinClick = (id: string, type: 'partner' | 'restaurant') => {
          if (type === 'partner') {
            setSelectedPin(s => partners.find(x => x.id === id) ?? s);
          } else {
            const entry = restOvMapRef.current.get(id);
            if (entry) setSelectedPin(entry.pin);
          }
        };

        kakao.maps.event.addListener(map, 'click', closePopup);

        // idle 이벤트 → 줌 변경 감지 + 오버레이 재빌드 + 뷰포트 fetch (디바운스 400ms)
        // idle은 pan/zoom 애니메이션 완전 종료 후 발생 → map.getLevel() 항상 최신값
        kakao.maps.event.addListener(map, 'idle', () => {
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          idleTimerRef.current = setTimeout(async () => {
            const currentZoom = map.getLevel();
            if (currentZoom !== zoomRef.current) {
              // 줌 레벨이 바뀌었으면 모든 오버레이를 새 줌으로 재빌드 (상호명 표시 여부 갱신)
              refreshRestOverlays(kakao, map);
            }
            // 새 뷰포트 데이터 fetch (증분)
            await fetchViewport(map);
          }, 400);
        });

        // 초기 파트너 칩 그리기
        rebuildPartners(kakao, map, partners, categoryRef.current);
        // 초기 뷰포트 fetch
        await fetchViewport(map);

        if (!cancelled) setMapReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? '카카오맵 로드 실패');
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── 파트너 / 카테고리 / 레이어 / 스타일 변경 ──────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    rebuildPartners(kakao, mapRef.current, partners, category);
    applyRestFilter(mapRef.current, category, layer, style);
  }, [category, style, layer, partners, rebuildPartners, applyRestFilter]);

  // ── AI 하이라이트 변경 ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    applyHighlight(kakao, mapRef.current, highlightIds, layer, category, style);
  }, [highlightIds, applyHighlight, layer, category, style]);

  const partnerActive = partners.filter(p => p.is_active).length;
  const partnerCoupon = partners.filter(p => p.activeCoupons > 0).length;
  const restCount     = restaurants.length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* 상단 바 */}
      <div className="flex items-center justify-between px-5 py-3 bg-sidebar border-b border-border-main shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-primary">언니픽 지도</h1>
          {!loading && (
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>파트너 <b className="text-[#FF6F0F]">{partners.length}</b></span>
              <span>운영중 <b className="text-[#22C55E]">{partnerActive}</b></span>
              <span>쿠폰 <b className="text-[#FF6F0F]">{partnerCoupon}</b></span>
              <span className="text-border-main">|</span>
              <span className="flex items-center gap-1">
                수집 업체 <b className="text-tertiary">{restCount}</b>
                {vpLoading && <Loader2 size={10} className="animate-spin text-[#FF6F0F]" />}
              </span>
            </div>
          )}
        </div>
        <div className="flex bg-card border border-border-subtle rounded-xl p-1 gap-1">
          {([
            ['partner', '파트너만'],
            ['all',     '전체 (수집 포함)'],
          ] as const).map(([v, label]) => (
            <button key={v} onClick={() => setLayer(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                layer === v ? 'bg-[#FF6F0F] text-white' : 'text-tertiary hover:text-primary'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* AI 검색 바 */}
      <div className="px-4 py-2 bg-sidebar border-b border-border-main shrink-0 relative">
        <form
          onSubmit={e => { e.preventDefault(); doAiSearch(aiQuery); }}
          className="flex items-center gap-2"
        >
          <div className={`flex-1 flex items-center gap-2 bg-card border rounded-xl px-3 py-2 transition ${
            suggestionOpen ? 'border-[#FF6F0F]/60 rounded-b-none' : 'border-border-subtle focus-within:border-[#FF6F0F]/60'
          }`}>
            <Sparkles size={13} className="text-[#FF6F0F] shrink-0" />
            <input
              ref={searchInputRef}
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onFocus={() => setSuggestionOpen(true)}
              onBlur={() => setTimeout(() => setSuggestionOpen(false), 150)}
              placeholder="AI 맛집 검색 — 예: 상남동 데이트 파스타, 쿠폰 있는 카페..."
              className="flex-1 bg-transparent text-xs text-primary placeholder:text-dim outline-none"
            />
            {aiQuery && (
              <button type="button" onClick={clearAiSearch} className="text-dim hover:text-muted transition">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!aiQuery.trim() || aiSearching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6F0F] text-white text-xs font-semibold disabled:opacity-40 transition hover:bg-[#E55F00]"
          >
            {aiSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            검색
          </button>
        </form>

        {/* 추천 검색어 드롭다운 */}
        {suggestionOpen && (
          <div className="absolute left-4 right-[4.5rem] top-full z-50 bg-card border border-[#FF6F0F]/40 border-t-0 rounded-b-xl shadow-lg overflow-hidden">
            <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
              <Clock size={10} className="text-dim" />
              <span className="text-[10px] text-dim font-semibold">
                {(() => {
                  const h = new Date().getHours();
                  if (h >= 6 && h < 11) return '아침 추천 검색어';
                  if (h >= 11 && h < 14) return '점심 추천 검색어';
                  if (h >= 14 && h < 18) return '오후 추천 검색어';
                  if (h >= 18 && h < 22) return '저녁 추천 검색어';
                  return '야간 추천 검색어';
                })()}
              </span>
            </div>
            <div className="px-2 pb-2 flex flex-wrap gap-1.5">
              {timeSuggestions.map(s => (
                <button
                  key={s.query}
                  type="button"
                  onMouseDown={() => {
                    setAiQuery(s.query);
                    setSuggestionOpen(false);
                    doAiSearch(s.query);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-fill-subtle border border-border-subtle text-[11px] text-secondary hover:border-[#FF6F0F]/50 hover:text-[#FF6F0F] hover:bg-[#FF6F0F]/5 transition whitespace-nowrap"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 장르(v2) 카테고리 탭 */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-sidebar border-b border-border-subtle shrink-0 overflow-x-auto scrollbar-none">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              category === c.key
                ? 'bg-[#FF6F0F] text-white shadow-sm'
                : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}>
            <span>{c.emoji}</span><span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* 용도(style) 탭 */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-sidebar border-b border-border-main shrink-0 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-dim font-semibold shrink-0 mr-1">용도</span>
        {STYLES.map(s => (
          <button key={s.key} onClick={() => setStyle(s.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              style === s.key
                ? 'bg-[#3B82F6] text-white shadow-sm'
                : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}>
            <span>{s.emoji}</span><span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* 지도 + 사이드 패널들 */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* AI 결과 패널 (좌측) */}
        <div className={`shrink-0 border-r border-border-main bg-sidebar overflow-hidden transition-all duration-300 ${
          aiPanelOpen ? 'w-72' : 'w-0'
        }`}>
          {aiPanelOpen && (
            <AiResultPanel
              results={aiResults}
              searching={aiSearching}
              onSelect={selectAiResult}
              onClose={clearAiSearch}
            />
          )}
        </div>

        {/* 지도 */}
        <div className="flex-1 relative">
          {(loading || (!mapReady && !error)) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
              <div className="w-10 h-10 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
              <p className="text-sm text-muted">{loading ? '데이터 로드 중...' : '지도 초기화 중...'}</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm font-semibold text-red-400">지도 로드 실패</p>
              <p className="text-xs text-muted text-center max-w-sm">{error}</p>
            </div>
          )}

          {/* 범례 */}
          {mapReady && (
            <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur-sm border border-border-subtle rounded-xl px-3 py-2.5 flex flex-col gap-2 text-xs">
              <div className="font-semibold text-tertiary mb-0.5">범례</div>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border-2 border-[#FF6F0F] bg-white inline-flex items-center justify-center text-[8px] font-bold text-[#FF6F0F]">N</span>
                <span className="text-tertiary">파트너 (쿠폰)</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border-2 border-[#22C55E] bg-white inline-block" />
                <span className="text-tertiary">파트너 (운영중)</span>
              </span>
              {layer === 'all' && <>
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6B7280] border border-white inline-block" />
                  <span className="text-tertiary">수집 업체</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#6B7280] border border-white inline-block" />
                  <span className="text-tertiary">수집 업체 (블로그 📝)</span>
                </span>
                {highlightIds.size > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded-full bg-[#FF6F0F] text-white text-[9px] font-black">✨</span>
                    <span className="text-tertiary">AI 추천</span>
                  </span>
                )}
              </>}
              {(category !== 'all' || style !== 'all') && (
                <div className="mt-1 pt-1 border-t border-border-subtle space-y-1">
                  {category !== 'all' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-[#FF6F0F]">장르</span>
                      <span className="text-[10px] text-secondary">{CATEGORIES.find(c => c.key === category)?.emoji} {category}</span>
                      <button onClick={() => setCategory('all')} className="text-dim hover:text-muted ml-auto"><X size={9} /></button>
                    </div>
                  )}
                  {style !== 'all' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-[#3B82F6]">용도</span>
                      <span className="text-[10px] text-secondary">{STYLES.find(s => s.key === style)?.emoji} {style}</span>
                      <button onClick={() => setStyle('all')} className="text-dim hover:text-muted ml-auto"><X size={9} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* 블로그 사이드 패널 (우측) */}
        <div className={`shrink-0 border-l border-border-main bg-sidebar overflow-hidden transition-all duration-300 ${
          selectedPin ? 'w-72' : 'w-0'
        }`}>
          {selectedPin && (
            <BlogPanel
              pin={selectedPin}
              onClose={() => setSelectedPin(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
