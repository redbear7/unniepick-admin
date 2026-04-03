'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsSDK } from '@/lib/googleMap';

export interface CouponMapItem {
  id:             string;
  title:          string;
  discount_type:  'percent' | 'amount';
  discount_value: number;
  is_active:      boolean;
  expires_at:     string;
  store_name:     string;
  store_lat:      number;
  store_lng:      number;
}

interface Props { coupons: CouponMapItem[]; }

function groupByStore(coupons: CouponMapItem[]) {
  const map = new globalThis.Map<string, { lat: number; lng: number; name: string; coupons: CouponMapItem[] }>();
  for (const c of coupons) {
    const key = `${c.store_lat.toFixed(5)},${c.store_lng.toFixed(5)}`;
    if (!map.has(key)) map.set(key, { lat: c.store_lat, lng: c.store_lng, name: c.store_name, coupons: [] });
    map.get(key)!.coupons.push(c);
  }
  return [...map.values()];
}

function discountLabel(c: CouponMapItem) {
  return c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`;
}

export default function CouponMap({ coupons }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  const valid = coupons.filter(c => c.store_lat && c.store_lng);

  useEffect(() => {
    if (valid.length === 0) { setStatus('empty'); return; }

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMapsSDK();
        if (cancelled || !containerRef.current) return;

        const google = (window as any).google;
        const now    = new Date();
        const groups = groupByStore(valid);
        const centerLat = groups.reduce((s, g) => s + g.lat, 0) / groups.length;
        const centerLng = groups.reduce((s, g) => s + g.lng, 0) / groups.length;

        const map = new google.maps.Map(containerRef.current, {
          center:    { lat: centerLat, lng: centerLng },
          zoom:      13,
          mapTypeId: 'roadmap',
          styles:    DARK_STYLE,
        });
        mapRef.current = map;

        const { MarkerClusterer } = await importClusterer(google);

        const markers = groups.map(group => {
          const activeCnt = group.coupons.filter(c => c.is_active && new Date(c.expires_at) >= now).length;
          const color     = activeCnt > 0 ? '#FF6F0F' : '#4B5563';

          const marker = new google.maps.Marker({
            position: { lat: group.lat, lng: group.lng },
            map,
            label: {
              text:      `🎟 ${group.name}${activeCnt > 0 ? ` (${activeCnt})` : ''}`,
              color:     '#fff',
              fontSize:  '11px',
              fontWeight:'700',
            },
            icon: {
              path:        google.maps.SymbolPath.CIRCLE,
              scale:       10,
              fillColor:   color,
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          });

          const rows = group.coupons.map(c => {
            const exp    = new Date(c.expires_at) < now;
            const active = c.is_active && !exp;
            return `<div style="background:#F8FAFC;border-radius:8px;padding:7px 10px;border-left:3px solid ${active ? '#22C55E' : '#9CA3AF'};margin-bottom:4px;">
              <div style="font-weight:600;font-size:12px;">${c.title}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:2px;">${discountLabel(c)} · <span style="color:${active ? '#22C55E' : '#9CA3AF'};font-weight:700;">${active ? '활성' : exp ? '만료' : '비활성'}</span></div>
            </div>`;
          }).join('');

          const iw = new google.maps.InfoWindow({
            content: `<div style="font-family:system-ui,sans-serif;padding:4px;min-width:200px;max-width:270px;">
              <div style="font-weight:800;font-size:14px;margin-bottom:4px;">🏪 ${group.name}</div>
              <div style="font-size:11px;color:#6B7280;margin-bottom:8px;">쿠폰 ${group.coupons.length}개 · 활성 <b style="color:#FF6F0F;">${activeCnt}</b>개</div>
              ${rows}
            </div>`,
          });

          marker.addListener('click', () => iw.open(map, marker));
          return marker;
        });

        new MarkerClusterer({ map, markers });
        if (!cancelled) setStatus('ready');
      } catch (e: any) {
        if (!cancelled) { setErrMsg(e.message ?? '알 수 없는 오류'); setStatus('error'); }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupons]);

  if (status === 'empty') return (
    <div className="flex flex-col items-center justify-center h-96 bg-[#1A1D23] rounded-2xl border border-white/5 gap-3">
      <span className="text-4xl">📍</span>
      <p className="text-sm font-semibold text-gray-400">위치 정보가 있는 쿠폰이 없어요</p>
      <p className="text-xs text-gray-600">전체 {coupons.length}개 중 위치 있는 쿠폰: {valid.length}개</p>
    </div>
  );

  if (status === 'error') return (
    <div className="flex flex-col items-center justify-center h-96 bg-[#1A1D23] rounded-2xl border border-white/5 gap-3">
      <span className="text-3xl">⚠️</span>
      <p className="text-sm font-semibold text-red-400">지도 로드 실패</p>
      <p className="text-xs text-gray-500 text-center max-w-xs">{errMsg}</p>
    </div>
  );

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/5" style={{ height: 600 }}>
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1A1D23] gap-3">
          <div className="w-8 h-8 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
          <p className="text-sm text-gray-500">지도 불러오는 중...</p>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// Google Maps MarkerClusterer (CDN 없이 인라인 구현)
async function importClusterer(google: any) {
  // @googlemaps/markerclusterer 없이 간단한 클러스터러 직접 구현
  class MarkerClusterer {
    constructor({ map, markers }: { map: any; markers: any[] }) {
      // 줌 레벨 8 이하에서만 클러스터링 (간단 구현)
      const updateClusters = () => {
        const zoom = map.getZoom();
        markers.forEach(m => m.setMap(zoom >= 12 ? map : null));
        if (zoom < 12) {
          // 대표 마커 하나만 표시 (중심)
          if (markers.length > 0) markers[0].setMap(map);
        }
      };
      google.maps.event.addListener(map, 'zoom_changed', updateClusters);
    }
  }
  return { MarkerClusterer };
}

const DARK_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road',               elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'water',              elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
];
