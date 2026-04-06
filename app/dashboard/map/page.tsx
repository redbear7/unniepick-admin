'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { loadGoogleMapsSDK } from '@/lib/googleMap';

interface StorePin {
  id:           string;
  name:         string;
  category:     string | null;
  address:      string | null;
  is_active:    boolean;
  lat:          number;
  lng:          number;
  activeCoupons: number;
  totalCoupons:  number;
}

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markersRef   = useRef<any[]>([]);
  const [stores,   setStores]   = useState<StorePin[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [error,    setError]    = useState('');
  const [filter,   setFilter]   = useState<'all' | 'active' | 'coupon'>('all');

  // ── 데이터 로드 ────────────────────────────────────────────
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
        id:           s.id,
        name:         s.name,
        category:     s.category,
        address:      s.address,
        is_active:    s.is_active,
        lat:          s.latitude,
        lng:          s.longitude,
        activeCoupons: couponMap.get(s.id)?.active ?? 0,
        totalCoupons:  couponMap.get(s.id)?.total  ?? 0,
      }));

      setStores(pins);
      setLoading(false);
    })();
  }, []);

  // ── Google Maps 초기화 ─────────────────────────────────────
  useEffect(() => {
    if (loading || stores.length === 0 || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMapsSDK();
        if (cancelled || !containerRef.current) return;

        const google = (window as any).google;

        // 한국 중심 (서울)
        const map = new google.maps.Map(containerRef.current, {
          center:    { lat: 35.2285, lng: 128.6811 },
          zoom:      15,
          mapTypeId: 'roadmap',
          styles:    DARK_STYLE,
        });
        mapRef.current = map;

        buildMarkers(google, map, stores, filter);
        if (!cancelled) setMapReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stores]);

  // ── 필터 변경 시 마커 재빌드 ─────────────────────────────
  useEffect(() => {
    if (!mapRef.current || stores.length === 0) return;
    const google = (window as any).google;
    if (!google) return;
    buildMarkers(google, mapRef.current, stores, filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const buildMarkers = (google: any, map: any, pins: StorePin[], f: string) => {
    // 기존 마커 제거
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const filtered = pins.filter(s => {
      if (f === 'active') return s.is_active;
      if (f === 'coupon') return s.activeCoupons > 0;
      return true;
    });

    const openIw = { current: null as any };

    filtered.forEach(store => {
      const color = store.activeCoupons > 0 ? '#FF6F0F' : store.is_active ? '#22C55E' : '#4B5563';

      const marker = new google.maps.Marker({
        position: { lat: store.lat, lng: store.lng },
        map,
        title: store.name,
        icon: {
          path:         google.maps.SymbolPath.CIRCLE,
          scale:        10,
          fillColor:    color,
          fillOpacity:  1,
          strokeColor:  '#fff',
          strokeWeight: 2,
        },
      });

      const couponBadge = store.activeCoupons > 0
        ? `<span style="background:#FF6F0F;color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:6px;">${store.activeCoupons}개</span>`
        : '';

      const iw = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui,sans-serif;padding:12px 14px;min-width:200px;background:#fff;border-radius:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:800;font-size:14px;color:#111;">${store.name}</span>
            <span style="font-size:10px;padding:2px 7px;border-radius:999px;background:${store.is_active ? '#DCFCE7' : '#F3F4F6'};color:${store.is_active ? '#16A34A' : '#6B7280'};font-weight:700;">
              ${store.is_active ? '운영중' : '비활성'}
            </span>
          </div>
          ${store.category ? `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px;">${store.category}</div>` : ''}
          ${store.address  ? `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">📍 ${store.address}</div>` : ''}
          <div style="display:flex;gap:8px;font-size:11px;">
            <span style="color:#6B7280;">쿠폰 ${store.totalCoupons}개</span>
            ${store.activeCoupons > 0 ? `<span style="color:#FF6F0F;font-weight:700;">활성 ${store.activeCoupons}개${couponBadge}</span>` : ''}
          </div>
        </div>`,
      });

      marker.addListener('click', () => {
        if (openIw.current) openIw.current.close();
        iw.open(map, marker);
        openIw.current = iw;
      });

      markersRef.current.push(marker);
    });
  };

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
                filter === v ? 'bg-[#FF6F0F] text-primary' : 'text-tertiary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        {(loading || (!mapReady && !error)) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
            <div className="w-10 h-10 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
            <p className="text-sm text-muted">{loading ? '매장 데이터 로드 중...' : 'Google Maps 초기화 중...'}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm font-semibold text-red-400">지도 로드 실패</p>
            <p className="text-xs text-muted text-center max-w-xs">{error}</p>
          </div>
        )}

        {!loading && stores.length === 0 && !error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface gap-3">
            <span className="text-4xl">📍</span>
            <p className="text-sm text-tertiary font-semibold">위치 정보가 있는 매장이 없어요</p>
            <p className="text-xs text-dim">매장 등록 시 위도/경도를 입력해주세요</p>
          </div>
        )}

        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

const DARK_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road',               elementType: 'geometry',          stylers: [{ color: '#304a7d' }] },
  { featureType: 'road',               elementType: 'labels.text.fill',  stylers: [{ color: '#98a5be' }] },
  { featureType: 'water',              elementType: 'geometry',          stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
];
