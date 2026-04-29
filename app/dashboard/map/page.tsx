'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { loadKakaoSDK } from '@/lib/kakaoMap';
import { X, Loader2, ChevronLeft } from 'lucide-react';
import BlogViewerModal from '@/components/BlogViewerModal';

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

// ── 카테고리 설정 ───────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',    label: '전체',    emoji: '🗺️' },
  { key: '한식',   label: '한식',    emoji: '🍚' },
  { key: '카페',   label: '카페',    emoji: '☕' },
  { key: '치킨',   label: '치킨',    emoji: '🍗' },
  { key: '술집/바', label: '술집/바', emoji: '🍺' },
  { key: '일식',   label: '일식',    emoji: '🍣' },
  { key: '중식',   label: '중식',    emoji: '🥢' },
  { key: '양식',   label: '양식',    emoji: '🍝' },
  { key: '분식',   label: '분식',    emoji: '🍢' },
  { key: '베이커리', label: '베이커리', emoji: '🥐' },
  { key: '간식',   label: '간식',    emoji: '🍡' },
] as const;

const CATEGORY_COLOR: Record<string, string> = {
  '한식':    '#E85D04',
  '카페':    '#7B5EA7',
  '치킨':    '#F77F00',
  '술집/바':  '#D62828',
  '일식':    '#3A86FF',
  '중식':    '#FB5607',
  '양식':    '#2EC4B6',
  '분식':    '#FFBE0B',
  '베이커리': '#C77DFF',
  '간식':    '#FF9AC9',
  '도시락':  '#6D6875',
  '샐러드':  '#52B788',
  '아시안':  '#F4A261',
  '해산물':  '#023E8A',
  '기타':    '#6B7280',
};

function getCatColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? '기타'] ?? '#6B7280';
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

  // 대표 리뷰 상단 정렬
  const sortedReviews = [...reviews].sort((a, b) => {
    const featDiff = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    if (featDiff !== 0) return featDiff;
    return (b.date ?? '') > (a.date ?? '') ? 1 : (b.date ?? '') < (a.date ?? '') ? -1 : 0;
  });

  useEffect(() => {
    if (pin.type === 'restaurant') {
      setReviews((pin.blog_reviews ?? []).filter(rv => rv.source !== 'cafe'));
    } else {
      // 파트너: naver_place_id로 restaurants에서 블로그 리뷰 fetch
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
          {/* 모달 헤더 */}
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
          {/* 모달 본문 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <h3 className="text-sm font-bold text-primary leading-relaxed">{selectedReview.title}</h3>
            {selectedReview.snippet && (
              <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">{selectedReview.snippet}</p>
            )}
          </div>
          {/* 원문 보기 버튼 */}
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
                {/* 헤더 행: 배지들 + 우측 액션 버튼 */}
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
                  {/* 액션 버튼 항상 표시 */}
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
                {/* 클릭 → 상세 모달 */}
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

// ── 메인 컴포넌트 ───────────────────────────────────────────────
export default function MapPage() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const overlaysRef   = useRef<any[]>([]);
  const clustererRef  = useRef<any>(null);
  const popupRef      = useRef<any>(null);

  const [partners,     setPartners]     = useState<PartnerPin[]>([]);
  const [restaurants,  setRestaurants]  = useState<RestaurantPin[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [mapReady,     setMapReady]     = useState(false);
  const [error,        setError]        = useState('');
  const [category,     setCategory]     = useState<string>('all');
  const [layer,        setLayer]        = useState<'partner' | 'all'>('all');

  // 블로그 패널
  const [selectedPin,  setSelectedPin]  = useState<MapPin | null>(null);

  // ── 데이터 로드 ────────────────────────────────────────────────
  useEffect(() => {
    const sb = createClient();
    (async () => {
      const [
        { data: storeData },
        { data: couponData },
        { data: restData },
      ] = await Promise.all([
        sb.from('stores')
          .select('id, name, category, address, is_active, latitude, longitude, naver_place_id, instagram_url, ai_summary')
          .not('latitude', 'is', null).not('longitude', 'is', null),
        sb.from('coupons').select('store_id, is_active, expires_at'),
        sb.from('restaurants')
          .select('id, name, kakao_category, unniepick_category, address, phone, latitude, longitude, kakao_place_url, blog_reviews, instagram_url, ai_summary')
          .eq('source', 'kakao')
          .not('latitude', 'is', null).not('longitude', 'is', null)
          .limit(3000),
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
        type: 'partner',
        id: s.id, name: s.name, category: s.category,
        address: s.address, is_active: s.is_active,
        lat: s.latitude, lng: s.longitude,
        activeCoupons: couponMap.get(s.id)?.active ?? 0,
        totalCoupons:  couponMap.get(s.id)?.total  ?? 0,
        naver_place_id: s.naver_place_id ?? null,
        instagram_url:  s.instagram_url  ?? null,
        ai_summary:     s.ai_summary     ?? null,
      })));

      setRestaurants((restData ?? []).map((r: any) => {
        let blogReviews: BlogReview[] = [];
        try {
          blogReviews = Array.isArray(r.blog_reviews)
            ? r.blog_reviews
            : JSON.parse(r.blog_reviews ?? '[]');
        } catch {}
        return {
          type: 'restaurant',
          id: r.id, name: r.name,
          kakao_category: r.kakao_category,
          unniepick_category: r.unniepick_category,
          address: r.address, phone: r.phone,
          lat: r.latitude, lng: r.longitude,
          kakao_place_url: r.kakao_place_url,
          blog_reviews: blogReviews,
          instagram_url: r.instagram_url ?? null,
          ai_summary:    r.ai_summary    ?? null,
        };
      }));

      setLoading(false);
    })();
  }, []);

  // ── 팝업 ────────────────────────────────────────────────────────
  const closePopup = useCallback(() => {
    popupRef.current?.setMap(null);
    popupRef.current = null;
  }, []);

  // ── 오버레이 빌드 ───────────────────────────────────────────────
  const buildOverlays = useCallback((
    kakao: any, map: any,
    pts: PartnerPin[], rests: RestaurantPin[],
    cat: string, lyr: string,
  ) => {
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    clustererRef.current?.clear();
    closePopup();

    (window as any).__mapClose    = closePopup;
    (window as any).__mapPinClick = (id: string, type: 'partner' | 'restaurant') => {
      if (type === 'partner') {
        const p = pts.find(x => x.id === id);
        if (p) setSelectedPin(p);
      } else {
        const r = rests.find(x => x.id === id);
        if (r) setSelectedPin(r);
      }
    };

    // ── 파트너 칩 ──────────────────────────────────────────────
    const filteredPartners = pts.filter(p => cat === 'all' || p.category === cat);

    filteredPartners.forEach(p => {
      const color    = p.activeCoupons > 0 ? '#FF6F0F' : p.is_active ? '#22C55E' : '#4B5563';
      const hasBlog  = !!(p.naver_place_id || p.instagram_url);
      const badge    = p.activeCoupons > 0
        ? ` <span style="background:#FF6F0F;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:800;">${p.activeCoupons}</span>`
        : '';
      const blogIcon = hasBlog
        ? `<span style="font-size:10px;margin-left:2px;" title="블로그 리뷰">📝</span>`
        : '';
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
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(p.lat, p.lng),
        content: html, yAnchor: 1, zIndex: 10,
      });
      ov.setMap(map);
      overlaysRef.current.push(ov);
    });

    // ── 레스토랑 마커 ────────────────────────────────────────────
    if (lyr === 'all') {
      const filteredRests = rests.filter(r => cat === 'all' || r.unniepick_category === cat);

      const markers = filteredRests.map(r => {
        const color   = getCatColor(r.unniepick_category);
        const hasBlog = r.blog_reviews.length > 0;
        // 블로그 있으면 약간 큰 사각형 닷, 없으면 기본 원
        const html = hasBlog
          ? `<div onclick="window.__mapPinClick('${r.id}','restaurant')" ` +
            `style="width:12px;height:12px;border-radius:3px;background:${color};` +
            `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;" title="블로그 리뷰 있음"></div>`
          : `<div onclick="window.__mapPinClick('${r.id}','restaurant')" ` +
            `style="width:10px;height:10px;border-radius:50%;background:${color};` +
            `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;"></div>`;
        return new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(r.lat, r.lng),
          content: html, zIndex: 3,
        });
      });

      markers.forEach(m => { m.setMap(map); overlaysRef.current.push(m); });
    }
  }, [closePopup]);

  // ── 카카오맵 초기화 ────────────────────────────────────────────
  useEffect(() => {
    if (loading || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        await loadKakaoSDK();
        if (cancelled || !containerRef.current) return;

        const kakao = (window as any).kakao;
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(35.2285, 128.6811),
          level: 7,
        });
        mapRef.current = map;
        kakao.maps.event.addListener(map, 'click', closePopup);

        if (kakao.maps.MarkerClusterer) {
          clustererRef.current = new kakao.maps.MarkerClusterer({
            map, averageCenter: true, minLevel: 5,
            disableClickZoom: false,
            styles: [{
              width: '36px', height: '36px', background: 'rgba(107,114,128,0.85)',
              borderRadius: '50%', color: '#fff', textAlign: 'center',
              lineHeight: '36px', fontSize: '12px', fontWeight: '700',
              border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }],
          });
        }

        buildOverlays(kakao, map, partners, restaurants, category, layer);
        if (!cancelled) setMapReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? '카카오맵 로드 실패');
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (!mapRef.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    buildOverlays(kakao, mapRef.current, partners, restaurants, category, layer);
  }, [category, layer, partners, restaurants, buildOverlays]);

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
              <span>수집 업체 <b className="text-tertiary">{restCount}</b></span>
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

      {/* 카테고리 탭 */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-sidebar border-b border-border-main shrink-0 overflow-x-auto">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              category === c.key
                ? 'bg-[#FF6F0F] text-white'
                : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}>
            <span>{c.emoji}</span><span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* 지도 + 사이드 패널 */}
      <div className="flex-1 flex overflow-hidden relative">

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
              </>}
            </div>
          )}

          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* 블로그 사이드 패널 */}
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
