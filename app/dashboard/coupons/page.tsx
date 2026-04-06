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
          <h1 className="text-2xl font-bold text-primary">쿠폰 관리</h1>
          <p className="text-sm text-muted mt-1">
            전체 {coupons.length}개 · 활성 {activeCount}개 · 지도 표시 {mapCount}개
          </p>
        </div>

        {/* 뷰 전환 */}
        <div className="flex bg-card border border-border-subtle rounded-xl p-1 gap-1">
          {([['list', <List size={14} />, '목록'], ['map', <Map size={14} />, '지도']] as const).map(([v, icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                view === v ? 'bg-[#FF6F0F] text-primary' : 'text-tertiary hover:text-primary'
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
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="쿠폰명, 가게명 검색"
            className="w-full bg-card border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
          />
        </div>
        {(['all', 'active', 'expired'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              filter === f ? 'bg-[#FF6F0F] text-primary' : 'bg-card border border-border-subtle text-tertiary hover:text-primary'
            }`}
          >
            {f === 'all' ? '전체' : f === 'active' ? '활성' : '만료/비활성'}
          </button>
        ))}
      </div>

      {/* ── 지도 뷰 ── */}
      {view === 'map' && (
        loading ? (
          <div className="bg-card rounded-2xl h-[600px] flex items-center justify-center">
            <div className="text-muted text-sm">지도 로딩 중...</div>
          </div>
        ) : (
          <>
            <p className="text-xs text-dim mb-3">
              🗺 매장 위치별 쿠폰 분포 · 마커 클릭 시 쿠폰 상세 · 여러 매장은 자동으로 묶음 표시
            </p>
            <CouponMap key={`${filter}-${query}`} coupons={mapItems} />
          </>
        )
      )}

      {/* ── 목록 뷰 ── */}
      {view === 'list' && (
        loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-border-main overflow-hidden animate-pulse">
                <div className="h-28 bg-fill-subtle" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-fill-subtle rounded w-3/4" />
                  <div className="h-2 bg-fill-subtle rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🎟</span>
            <p className="text-muted text-sm">쿠폰이 없어요</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(coupon => {
              const isExpired = new Date(coupon.expires_at) < now;
              const usageRate = coupon.total_quantity > 0
                ? Math.round((coupon.issued_count / coupon.total_quantity) * 100)
                : 0;
              const statusOk = coupon.is_active && !isExpired;
              return (
                <div key={coupon.id}
                  className={`flex flex-col rounded-xl overflow-hidden border transition hover:bg-white/[0.06] ${
                    statusOk ? 'bg-white/[0.03] border-border-main hover:border-border-subtle' : 'bg-white/[0.02] border-border-main opacity-60'
                  }`}>

                  {/* 할인율 배너 */}
                  <div className={`flex items-center justify-center py-6 relative ${
                    statusOk ? 'bg-[#FF6F0F]/10' : 'bg-fill-subtle'
                  }`}>
                    <span className={`text-3xl font-black tracking-tight ${statusOk ? 'text-[#FF6F0F]' : 'text-dim'}`}>
                      {discountLabel(coupon)}
                    </span>
                    {isExpired && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">만료</span>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                    <p className="text-primary text-xs font-semibold truncate leading-tight">{coupon.title}</p>
                    <p className="text-muted text-[10px] truncate">
                      {coupon.stores?.name ?? '-'}
                      {coupon.stores?.latitude && <span className="ml-1 text-[#FF6F0F]/60">📍</span>}
                    </p>

                    {/* 사용률 바 */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[9px] text-dim">
                        <span>발급</span>
                        <span>{coupon.issued_count} / {coupon.total_quantity}</span>
                      </div>
                      <div className="h-1 bg-fill-medium rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${usageRate >= 90 ? 'bg-red-400' : 'bg-[#FF6F0F]'}`}
                          style={{ width: `${usageRate}%` }} />
                      </div>
                    </div>

                    {/* 만료일 + 상태토글 */}
                    <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border-main">
                      <span className={`text-[9px] ${isExpired ? 'text-red-400' : 'text-dim'}`}>
                        {new Date(coupon.expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                      <button
                        onClick={() => toggleActive(coupon)}
                        disabled={toggling === coupon.id}
                        className={`flex items-center gap-0.5 text-[10px] font-semibold transition disabled:opacity-50 ${
                          statusOk ? 'text-green-400' : 'text-dim'
                        }`}>
                        {toggling === coupon.id
                          ? <div className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
                          : statusOk
                            ? <><ToggleRight size={14} /> 활성</>
                            : <><ToggleLeft  size={14} /> {isExpired ? '만료' : '비활성'}</>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
