'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase';
import { Search, ToggleLeft, ToggleRight, List, Map } from 'lucide-react';
import type { CouponMapItem } from '@/components/CouponMap';

// SSR 비활성화 (Leaflet은 window 객체 필요)
const CouponMap = dynamic(() => import('@/components/CouponMap'), { ssr: false });

interface Coupon {
  id:             string;
  title:          string;
  discount_type:  'percent' | 'amount';
  discount_value: number;
  total_quantity: number;
  issued_count:   number;
  is_active:      boolean;
  expires_at:     string;
  created_at:     string;
  stores:         { name: string; latitude: number | null; longitude: number | null } | null;
}

export default function CouponsPage() {
  const [coupons,  setCoupons]  = useState<Coupon[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [filter,   setFilter]   = useState<'all' | 'active' | 'expired'>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [view,     setView]     = useState<'list' | 'map'>('list');

  const load = async () => {
    const sb = createClient();
    const { data } = await sb
      .from('coupons')
      .select('id, title, discount_type, discount_value, total_quantity, issued_count, is_active, expires_at, created_at, stores(name, latitude, longitude)')
      .order('created_at', { ascending: false });
    setCoupons((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const sb = createClient();
    load();
    const channel = sb
      .channel('coupons-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (coupon: Coupon) => {
    setToggling(coupon.id);
    const sb = createClient();
    await sb.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
    setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
    setToggling(null);
  };

  const now = new Date();

  const filtered = useMemo(() => coupons.filter(c => {
    const isExpired = new Date(c.expires_at) < now;
    const matchF = filter === 'all' || (filter === 'active' ? c.is_active && !isExpired : isExpired || !c.is_active);
    const matchQ = !query || c.title.includes(query) || (c.stores?.name ?? '').includes(query);
    return matchF && matchQ;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [coupons, filter, query]);

  // 지도용 데이터 — 위도/경도 있는 쿠폰만, 필터 적용
  const mapItems = useMemo<CouponMapItem[]>(() =>
    filtered
      .filter(c => c.stores?.latitude && c.stores?.longitude)
      .map(c => ({
        id:            c.id,
        title:         c.title,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        is_active:     c.is_active,
        expires_at:    c.expires_at,
        store_name:    c.stores!.name,
        store_lat:     c.stores!.latitude!,
        store_lng:     c.stores!.longitude!,
      })),
  [filtered]);

  const discountLabel = (c: Coupon) =>
    c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`;

  const activeCount = coupons.filter(c => c.is_active && new Date(c.expires_at) >= now).length;
  const mapCount    = coupons.filter(c => c.stores?.latitude && c.stores?.longitude).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">쿠폰 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            전체 {coupons.length}개 · 활성 {activeCount}개 · 지도 표시 {mapCount}개
          </p>
        </div>

        {/* 뷰 전환 */}
        <div className="flex bg-[#1A1D23] border border-white/10 rounded-xl p-1 gap-1">
          {([['list', <List size={14} />, '목록'], ['map', <Map size={14} />, '지도']] as const).map(([v, icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                view === v ? 'bg-[#FF6F0F] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="쿠폰명, 가게명 검색"
            className="w-full bg-[#1A1D23] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
          />
        </div>
        {(['all', 'active', 'expired'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              filter === f ? 'bg-[#FF6F0F] text-white' : 'bg-[#1A1D23] border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? '전체' : f === 'active' ? '활성' : '만료/비활성'}
          </button>
        ))}
      </div>

      {/* ── 지도 뷰 ── */}
      {view === 'map' && (
        loading ? (
          <div className="bg-[#1A1D23] rounded-2xl h-[600px] flex items-center justify-center">
            <div className="text-gray-500 text-sm">지도 로딩 중...</div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-600 mb-3">
              🗺 매장 위치별 쿠폰 분포 · 마커 클릭 시 쿠폰 상세 · 여러 매장은 자동으로 묶음 표시
            </p>
            <CouponMap key={`${filter}-${query}`} coupons={mapItems} />
          </>
        )
      )}

      {/* ── 목록 뷰 ── */}
      {view === 'list' && (
        <div className="bg-[#1A1D23] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">쿠폰</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">가게</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">할인</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">발급 현황</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">만료일</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-600">쿠폰이 없어요</td>
                </tr>
              ) : (
                filtered.map(coupon => {
                  const isExpired = new Date(coupon.expires_at) < now;
                  const usageRate = coupon.total_quantity > 0
                    ? Math.round((coupon.issued_count / coupon.total_quantity) * 100)
                    : 0;
                  return (
                    <tr key={coupon.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{coupon.title}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-400">
                        <span>{coupon.stores?.name ?? '-'}</span>
                        {coupon.stores?.latitude && (
                          <span className="ml-1.5 text-[10px] text-[#FF6F0F]/60">📍</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-[#FF6F0F]">{discountLabel(coupon)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-400">{coupon.issued_count} / {coupon.total_quantity}</span>
                          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF6F0F] rounded-full" style={{ width: `${usageRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
                          {isExpired ? '⚠️ ' : ''}{new Date(coupon.expires_at).toLocaleDateString('ko-KR')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => toggleActive(coupon)}
                          disabled={toggling === coupon.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                            coupon.is_active && !isExpired
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {coupon.is_active && !isExpired
                            ? <><ToggleRight size={13} /> 활성</>
                            : <><ToggleLeft  size={13} /> {isExpired ? '만료' : '비활성'}</>}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
