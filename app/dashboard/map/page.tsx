'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { loadKakaoSDK } from '@/lib/kakaoMap';

// ── 타입 ──────────────────────────────────────────────────────
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
          .select('id, name, category, address, is_active, latitude, longitude')
          .not('latitude', 'is', null).not('longitude', 'is', null),
        sb.from('coupons').select('store_id, is_active, expires_at'),
        sb.from('restaurants')
          .select('id, name, kakao_category, unniepick_category, address, phone, latitude, longitude, kakao_place_url')
          .eq('source', 'kakao')
          .not('latitude', 'is', null).not('longitude', 'is', null)
          .limit(3000),
      ]);

      // 파트너 쿠폰 집계
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
      })));

      setRestaurants((restData ?? []).map((r: any) => ({
        type: 'restaurant',
        id: r.id, name: r.name,
        kakao_category: r.kakao_category,
        unniepick_category: r.unniepick_category,
        address: r.address, phone: r.phone,
        lat: r.latitude, lng: r.longitude,
        kakao_place_url: r.kakao_place_url,
      })));

      setLoading(false);
    })();
  }, []);

  // ── 팝업 ────────────────────────────────────────────────────────
  const closePopup = useCallback(() => {
    popupRef.current?.setMap(null);
    popupRef.current = null;
  }, []);

  const showPartnerPopup = useCallback((kakao: any, map: any, p: PartnerPin) => {
    closePopup();
    const html =
      `<div style="position:relative;background:#fff;border-radius:14px;padding:14px 16px 12px;` +
      `min-width:220px;max-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.22);` +
      `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
        `<button onclick="window.__mapClose()" style="position:absolute;top:10px;right:10px;` +
        `background:none;border:none;cursor:pointer;color:#9CA3AF;font-size:15px;padding:2px 4px;">✕</button>` +
        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">` +
          `<span style="font-size:10px;padding:2px 7px;border-radius:999px;font-weight:800;` +
          `background:#FFF3EB;color:#FF6F0F;">파트너</span>` +
          `<span style="font-size:10px;padding:2px 7px;border-radius:999px;font-weight:700;` +
          `background:${p.is_active ? '#DCFCE7' : '#F3F4F6'};` +
          `color:${p.is_active ? '#16A34A' : '#6B7280'};">${p.is_active ? '운영중' : '비활성'}</span>` +
        `</div>` +
        `<div style="font-weight:800;font-size:14px;color:#111;margin-bottom:6px;padding-right:20px;">` +
          `${esc(p.name)}</div>` +
        (p.address ? `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">📍 ${esc(p.address)}</div>` : '') +
        `<div style="display:flex;gap:10px;font-size:11px;border-top:1px solid #F3F4F6;padding-top:8px;">` +
          `<span style="color:#6B7280;">쿠폰 ${p.totalCoupons}개</span>` +
          (p.activeCoupons > 0 ? `<span style="color:#FF6F0F;font-weight:700;">활성 ${p.activeCoupons}개</span>` : '') +
        `</div>` +
      `</div>`;
    const popup = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(p.lat, p.lng),
      content: html, yAnchor: 1.12, zIndex: 20,
    });
    popup.setMap(map);
    popupRef.current = popup;
  }, [closePopup]);

  const showRestaurantPopup = useCallback((kakao: any, map: any, r: RestaurantPin) => {
    closePopup();
    const color = getCatColor(r.unniepick_category);
    const html =
      `<div style="position:relative;background:#fff;border-radius:14px;padding:14px 16px 12px;` +
      `min-width:220px;max-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.22);` +
      `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
        `<button onclick="window.__mapClose()" style="position:absolute;top:10px;right:10px;` +
        `background:none;border:none;cursor:pointer;color:#9CA3AF;font-size:15px;padding:2px 4px;">✕</button>` +
        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">` +
          `<span style="font-size:10px;padding:2px 7px;border-radius:999px;font-weight:700;` +
          `background:${color}22;color:${color};">${esc(r.unniepick_category ?? '기타')}</span>` +
        `</div>` +
        `<div style="font-weight:800;font-size:14px;color:#111;margin-bottom:4px;padding-right:20px;">` +
          `${esc(r.name)}</div>` +
        (r.kakao_category
          ? `<div style="font-size:10px;color:#9CA3AF;margin-bottom:6px;">${esc(r.kakao_category)}</div>`
          : '') +
        (r.address ? `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">📍 ${esc(r.address)}</div>` : '') +
        (r.phone   ? `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">📞 ${esc(r.phone)}</div>` : '') +
        `<div style="border-top:1px solid #F3F4F6;padding-top:10px;display:flex;flex-direction:column;gap:6px;">` +
          `<div style="font-size:11px;color:#9CA3AF;font-weight:600;">언니픽 미입점 업체</div>` +
          (r.kakao_place_url
            ? `<a href="${esc(r.kakao_place_url)}" target="_blank" ` +
              `style="font-size:11px;color:#3A86FF;font-weight:700;text-decoration:none;">카카오맵에서 보기 →</a>`
            : '') +
        `</div>` +
      `</div>`;
    const popup = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(r.lat, r.lng),
      content: html, yAnchor: 1.12, zIndex: 20,
    });
    popup.setMap(map);
    popupRef.current = popup;
  }, [closePopup]);

  // ── 오버레이 빌드 ───────────────────────────────────────────────
  const buildOverlays = useCallback((
    kakao: any, map: any,
    pts: PartnerPin[], rests: RestaurantPin[],
    cat: string, lyr: string,
  ) => {
    // 기존 오버레이 제거
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    clustererRef.current?.clear();
    closePopup();

    (window as any).__mapClose = closePopup;

    // ── 파트너 마커 ──────────────────────────────────────────────
    const filteredPartners = pts.filter(p =>
      cat === 'all' || p.category === cat
    );

    (window as any).__mapPartnerClick = (id: string) => {
      const p = pts.find(x => x.id === id);
      if (p) showPartnerPopup(kakao, map, p);
    };

    filteredPartners.forEach(p => {
      const color = p.activeCoupons > 0 ? '#FF6F0F' : p.is_active ? '#22C55E' : '#4B5563';
      const badge = p.activeCoupons > 0
        ? ` <span style="background:#FF6F0F;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:800;">${p.activeCoupons}</span>`
        : '';
      const html =
        `<div onclick="window.__mapPartnerClick('${p.id}')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">` +
          `<div style="display:flex;align-items:center;gap:4px;background:#fff;border-radius:20px;` +
          `border:2.5px solid ${color};padding:4px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.2);` +
          `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
            `<span style="font-size:11px;font-weight:800;color:${color};white-space:nowrap;` +
            `overflow:hidden;text-overflow:ellipsis;max-width:110px;">${esc(p.name)}</span>${badge}` +
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

    // ── 레스토랑 마커 (클러스터) ──────────────────────────────────
    if (lyr === 'all') {
      const filteredRests = rests.filter(r =>
        cat === 'all' || r.unniepick_category === cat
      );

      (window as any).__mapRestClick = (id: string) => {
        const r = rests.find(x => x.id === id);
        if (r) showRestaurantPopup(kakao, map, r);
      };

      const markers = filteredRests.map(r => {
        const color = getCatColor(r.unniepick_category);
        const html =
          `<div onclick="window.__mapRestClick('${r.id}')" ` +
          `style="width:10px;height:10px;border-radius:50%;background:${color};` +
          `border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;"></div>`;
        return new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(r.lat, r.lng),
          content: html, zIndex: 3,
        });
      });

      // 클러스터러에 마커 추가
      if (clustererRef.current) {
        clustererRef.current.addOverlays(markers);
      } else {
        markers.forEach(m => {
          m.setMap(map);
          overlaysRef.current.push(m);
        });
      }
    }
  }, [closePopup, showPartnerPopup, showRestaurantPopup]);

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

        // 클러스터러 초기화
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

  // ── 필터 변경 → 재빌드 ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    buildOverlays(kakao, mapRef.current, partners, restaurants, category, layer);
  }, [category, layer, partners, restaurants, buildOverlays]);

  // ── 통계 ────────────────────────────────────────────────────────
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

        {/* 레이어 토글 */}
        <div className="flex bg-card border border-border-subtle rounded-xl p-1 gap-1">
          {([
            ['partner', '파트너만'],
            ['all',     '전체 (수집 포함)'],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setLayer(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                layer === v ? 'bg-[#FF6F0F] text-white' : 'text-tertiary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-sidebar border-b border-border-main shrink-0 overflow-x-auto">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              category === c.key
                ? 'bg-[#FF6F0F] text-white'
                : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}
          >
            <span>{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        {/* 로딩 */}
        {(loading || (!mapReady && !error)) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
            <div className="w-10 h-10 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
            <p className="text-sm text-muted">{loading ? '데이터 로드 중...' : '지도 초기화 중...'}</p>
          </div>
        )}

        {/* 에러 */}
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
            {layer === 'all' && (
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6B7280] border border-white inline-block" />
                <span className="text-tertiary">수집 업체 (미입점)</span>
              </span>
            )}
          </div>
        )}

        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
