'use client';

/**
 * KakaoMapPicker
 * 가게 수정 모달 — 위치 미니 지도 + 드래그 핀
 *
 * Props:
 *   lat / lng   : 현재 좌표 (null 이면 기본 위치 진해구 중심)
 *   onChange    : 핀 이동 시 콜백 (lat, lng)
 *   readonly    : 드래그/클릭 비활성 (기본 false)
 *   height      : 컨테이너 높이 (기본 '220px')
 */

import { useEffect, useRef, useState } from 'react';
import { loadKakaoSDK } from '@/lib/kakaoMap';
import { MapPin, RotateCcw } from 'lucide-react';

interface Props {
  lat:      number | null;
  lng:      number | null;
  onChange: (lat: number, lng: number) => void;
  readonly?: boolean;
  height?:   string;
}

// 기본 중심 — 창원시 진해구
const DEFAULT = { lat: 35.1479, lng: 128.6679 };

export default function KakaoMapPicker({
  lat, lng, onChange, readonly = false, height = '220px',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markerRef    = useRef<any>(null);
  const skipSync     = useRef(false);   // 외부 prop 변경 vs 드래그 충돌 방지

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  /* ─── 지도 초기화 ─── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadKakaoSDK();
        if (cancelled || !containerRef.current) return;

        const { maps } = (window as any).kakao;
        const center   = new maps.LatLng(lat ?? DEFAULT.lat, lng ?? DEFAULT.lng);

        const map = new maps.Map(containerRef.current, {
          center,
          level: 4,
        });
        mapRef.current = map;

        const marker = new maps.Marker({
          position: center,
          map,
          draggable: !readonly,
        });
        markerRef.current = marker;

        if (!readonly) {
          // 핀 드래그 끝
          maps.event.addListener(marker, 'dragend', () => {
            skipSync.current = true;
            const pos = marker.getPosition();
            onChange(pos.getLat(), pos.getLng());
            setTimeout(() => { skipSync.current = false; }, 100);
          });

          // 지도 클릭 → 핀 이동
          maps.event.addListener(map, 'click', (e: any) => {
            const ll = e.latLng;
            marker.setPosition(ll);
            skipSync.current = true;
            onChange(ll.getLat(), ll.getLng());
            setTimeout(() => { skipSync.current = false; }, 100);
          });
        }

        if (!cancelled) setStatus('ready');
      } catch (e: any) {
        if (!cancelled) { setErrMsg(e.message); setStatus('error'); }
      }
    })();

    return () => { cancelled = true; };
  // 마운트 시 1회만
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── 외부 props (lat/lng) 변경 시 핀·지도 이동 ─── */
  useEffect(() => {
    if (skipSync.current) return;
    if (!mapRef.current || !markerRef.current) return;
    if (lat == null || lng == null) return;

    const pos = new (window as any).kakao.maps.LatLng(lat, lng);
    markerRef.current.setPosition(pos);
    mapRef.current.setCenter(pos);
    mapRef.current.setLevel(4);
  }, [lat, lng]);

  /* ─── 현재 위치로 리셋 ─── */
  const resetToCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const pos = new (window as any).kakao.maps.LatLng(coords.latitude, coords.longitude);
      markerRef.current?.setPosition(pos);
      mapRef.current?.setCenter(pos);
      onChange(coords.latitude, coords.longitude);
    });
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-border-subtle" style={{ height }}>

      {/* 로딩 */}
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card gap-2">
          <div className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          <p className="text-[11px] text-muted">지도 불러오는 중...</p>
        </div>
      )}

      {/* 오류 */}
      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card gap-2 p-4">
          <MapPin size={20} className="text-red-400" />
          <p className="text-xs text-red-400 font-semibold">지도 로드 실패</p>
          <p className="text-[10px] text-muted text-center whitespace-pre-wrap">{errMsg}</p>
        </div>
      )}

      {/* 지도 컨테이너 */}
      <div ref={containerRef} className="w-full h-full" />

      {/* 안내 배지 */}
      {status === 'ready' && !readonly && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[10px] text-white/70">
            핀을 드래그하거나 지도를 클릭해 위치를 조정하세요
          </span>
          <button
            onClick={resetToCurrentLocation}
            className="pointer-events-auto flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[10px] text-white/80 hover:text-white transition"
            title="내 현재 위치"
          >
            <RotateCcw size={10} /> 내 위치
          </button>
        </div>
      )}

      {/* 좌표 오버레이 */}
      {status === 'ready' && lat != null && lng != null && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-lg text-[9px] text-white/60 font-mono pointer-events-none">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}
