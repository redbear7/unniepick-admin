'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { loadKakaoSDK } from '@/lib/kakaoMap';

interface StorePin {
  id:            string;
  name:          string;
  category:      string | null;
  address:       string | null;
  is_active:     boolean;
  lat:           number;
  lng:           number;
  activeCoupons: number;
  totalCoupons:  number;
}

/** HTML 특수문자 이스케이프 */
function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const overlaysRef  = useRef<any[]>([]);
  const popupRef     = useRef<any>(null);

  const [stores,   setStores]   = useState<StorePin[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error,    setError]    = useState('');
  const [filter,   setFilter]   = useState<'all' | 'active' | 'coupon'>('all');

  // ── 데이터 로드 ──────────────────────────────────────────────
  useEffect(() => {
    const sb = createClient();
    (async () => {
      const [{ data: storeData }, { data: couponData }] = await Promise.all([
        sb.from('stores')
          .select('id, name, category, address, is_active, latitude, longitude')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
        sb.from('coupons')
          .select('store_id, is_active, expires_at'),
      ]);

      const now = new Date();
      const couponMap = new globalThis.Map<string, { total: number; active: number }>();
      (couponData ?? []).forEach((c: any) => {
        const prev = couponMap.get(c.store_id) ?? { total: 0, active: 0 };
        couponMap.set(c.store_id, {
          total:  prev.total + 1,
          active: prev.active + (c.is_active && new Date(c.expires_at) >= now ? 1 : 0),
        });
      });

      const pins: StorePin[] = (storeData ?? []).map((s: any) => ({
        id:            s.id,
        name:          s.name,
        category:      s.category,
        address:       s.address,
        is_active:     s.is_active,
        lat:           s.latitude,
        lng:           s.longitude,
        activeCoupons: couponMap.get(s.id)?.active ?? 0,
        totalCoupons:  couponMap.get(s.id)?.total  ?? 0,
      }));

      setStores(pins);
      setLoading(false);
    })();
  }, []);

  // ── 팝업 닫기 ────────────────────────────────────────────────
  const closePopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.setMap(null);
      popupRef.current = null;
    }
  }, []);

  // ── 팝업 열기 ────────────────────────────────────────────────
  const showPopup = useCallback((kakao: any, map: any, store: StorePin) => {
    closePopup();

    const hasCoupon = store.activeCoupons > 0;
    const isActive  = store.is_active;

    const popupHtml =
      `<div style="position:relative;background:#fff;border-radius:14px;padding:14px 16px 12px;` +
      `min-width:220px;max-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.22);` +
      `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
        `<button onclick="window.__kakaoMapClose()" style="position:absolute;top:10px;right:10px;` +
        `background:none;border:none;cursor:pointer;color:#9CA3AF;font-size:15px;line-height:1;` +
        `padding:2px 4px;">✕</button>` +
        `<div style="font-weight:800;font-size:14px;color:#111;margin-bottom:6px;padding-right:20px;">` +
          `${esc(store.name)}</div>` +
        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">` +
          `<span style="font-size:10px;padding:2px 8px;border-radius:999px;` +
          `background:${isActive ? '#DCFCE7' : '#F3F4F6'};` +
          `color:${isActive ? '#16A34A' : '#6B7280'};font-weight:700;">` +
          `${isActive ? '운영중' : '비활성'}</span>` +
          (store.category
            ? `<span style="font-size:10px;color:#9CA3AF;">${esc(store.category)}</span>`
            : '') +
        `</div>` +
        (store.address
          ? `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">📍 ${esc(store.address)}</div>`
          : '') +
        `<div style="display:flex;gap:10px;font-size:11px;` +
        `border-top:1px solid #F3F4F6;padding-top:8px;">` +
          `<span style="color:#6B7280;">쿠폰 ${store.totalCoupons}개</span>` +
          (hasCoupon
            ? `<span style="color:#FF6F0F;font-weight:700;">활성 ${store.activeCoupons}개</span>`
            : '') +
        `</div>` +
      `</div>`;

    const popup = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(store.lat, store.lng),
      content:  popupHtml,
      yAnchor:  1.12,
      zIndex:   20,
    });
    popup.setMap(map);
    popupRef.current = popup;

    (window as any).__kakaoMapClose = closePopup;
  }, [closePopup]);

  // ── 오버레이 빌드 ───────────────────────────────────────────
  const buildOverlays = useCallback((
    kakao: any,
    map: any,
    pins: StorePin[],
    f: string,
  ) => {
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    closePopup();

    const filtered = pins.filter(s => {
      if (f === 'active') return s.is_active;
      if (f === 'coupon') return s.activeCoupons > 0;
      return true;
    });

    // 전역 클릭 핸들러 — 칩 onclick에서 호출
    (window as any).__kakaoMapClick = (id: string) => {
      const store = pins.find(s => s.id === id);
      if (!store) return;
      showPopup(kakao, map, store);
    };
    (window as any).__kakaoMapClose = closePopup;

    filtered.forEach(store => {
      const color =
        store.activeCoupons > 0 ? '#FF6F0F'
        : store.is_active       ? '#22C55E'
        :                         '#4B5563';

      const textColor =
        store.activeCoupons > 0 ? '#FF6F0F'
        : store.is_active       ? '#22C55E'
        :                         '#9CA3AF';

      const badge =
        store.activeCoupons > 0
          ? ` <span style="background:#FF6F0F;color:#fff;border-radius:999px;` +
            `padding:1px 6px;font-size:10px;font-weight:800;">${store.activeCoupons}</span>`
          : '';

      const chipHtml =
        `<div onclick="window.__kakaoMapClick('${store.id}')" ` +
        `style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">` +
          `<div style="display:flex;align-items:center;gap:4px;background:#fff;` +
          `border-radius:20px;border:2px solid ${color};padding:4px 10px;` +
          `box-shadow:0 2px 6px rgba(0,0,0,0.18);max-width:160px;` +
          `font-family:-apple-system,BlinkMacSystemFont,sans-serif;">` +
            `<span style="font-size:11px;font-weight:700;color:${textColor};` +
            `white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;">` +
            `${esc(store.name)}</span>` +
            badge +
          `</div>` +
          `<div style="width:0;height:0;border-left:5px solid transparent;` +
          `border-right:5px solid transparent;border-top:7px solid ${color};margin-top:-1px;">` +
          `</div>` +
        `</div>`;

      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(store.lat, store.lng),
        content:  chipHtml,
        yAnchor:  1,
        zIndex:   5,
      });
      ov.setMap(map);
      overlaysRef.current.push(ov);
    });
  }, [closePopup, showPopup]);

  // ── 카카오맵 초기화 ──────────────────────────────────────────
  useEffect(() => {
    if (loading || stores.length === 0 || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        await loadKakaoSDK();
        if (cancelled || !containerRef.current) return;

        const kakao = (window as any).kakao;

        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(35.2285, 128.6811),
          level:  5,
        });
        mapRef.current = map;

        // 빈 곳 클릭 → 팝업 닫기
        kakao.maps.event.addListener(map, 'click', closePopup);

        buildOverlays(kakao, map, stores, filter);
        if (!cancelled) setMapReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? '카카오맵 로드 실패');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stores]);

  // ── 필터 변경 → 오버레이 재빌드 ─────────────────────────────
  useEffect(() => {
    if (!mapRef.current || stores.length === 0) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps) return;
    buildOverlays(kakao, mapRef.current, stores, filter);
  }, [filter, stores, buildOverlays]);

  // 통계
  const total       = stores.length;
  const activeCount = stores.filter(s => s.is_active).length;
  const couponCount = stores.filter(s => s.activeCoupons > 0).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-5 py-3 bg-sidebar border-b border-border-main shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold text-primary">매장 지도</h1>
          {!loading && (
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>전체 <b className="text-primary">{total}</b></span>
              <span>운영중 <b className="text-[#22C55E]">{activeCount}</b></span>
              <span>쿠폰 보유 <b className="text-[#FF6F0F]">{couponCount}</b></span>
            </div>
          )}
        </div>

        {/* 필터 */}
        <div className="flex bg-card border border-border-subtle rounded-xl p-1 gap-1">
          {([
            ['all',    '전체'],
            ['active', '운영중'],
            ['coupon', '쿠폰 보유'],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === v
                  ? 'bg-[#FF6F0F] text-primary'
                  : 'text-tertiary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        {/* 로딩 */}
        {(loading || (!mapReady && !error)) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
            <div className="w-10 h-10 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
            <p className="text-sm text-muted">
              {loading ? '매장 데이터 로드 중...' : '카카오맵 초기화 중...'}
            </p>
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

        {/* 데이터 없음 */}
        {!loading && stores.length === 0 && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
            <span className="text-4xl">📍</span>
            <p className="text-sm text-tertiary font-semibold">위치 정보가 있는 매장이 없어요</p>
            <p className="text-xs text-dim">매장 등록 시 위도/경도를 입력해주세요</p>
          </div>
        )}

        {/* 범례 */}
        {mapReady && (
          <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur-sm border border-border-subtle rounded-xl px-3 py-2 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6F0F] inline-block" />
              <span className="text-tertiary">쿠폰 보유</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] inline-block" />
              <span className="text-tertiary">운영중</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4B5563] inline-block" />
              <span className="text-tertiary">비활성</span>
            </span>
          </div>
        )}

        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
