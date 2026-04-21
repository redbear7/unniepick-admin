'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useOwnerSession } from '@/components/OwnerShell';
import { Ticket, Send, CheckCircle2, CreditCard, BarChart3 } from 'lucide-react';

interface CouponStat {
  id: string;
  title: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  total_quantity: number;
  issued_count: number;
  is_active: boolean;
  expires_at: string;
  used_count: number;
}

interface KPI {
  activeCoupons: number;
  totalIssued: number;
  totalUsed: number;
  stampCustomers: number;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '');
}

function fmtDiscount(type: 'percent' | 'amount', value: number): string {
  return type === 'percent' ? `${value}%` : `${value.toLocaleString()}원`;
}

function dDay(iso: string): string {
  const diff = new Date(iso).setHours(23, 59, 59, 999) - Date.now();
  if (diff < 0) return '만료됨';
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days === 0 ? '오늘 만료' : `D-${days}`;
}

export default function OwnerStatsPage() {
  const { session } = useOwnerSession();
  const [kpi,         setKpi]       = useState<KPI | null>(null);
  const [couponStats, setCouponStats] = useState<CouponStat[]>([]);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState('');

  useEffect(() => {
    if (!session) return;

    const load = async () => {
      const sb = createClient();

      // 가게 ID 조회
      const { data: storeData } = await sb
        .from('stores')
        .select('id')
        .eq('owner_id', session.user_id)
        .maybeSingle();

      if (!storeData) { setLoading(false); return; }
      const storeId = storeData.id;

      // 쿠폰 조회
      const { data: couponData, error: couponErr } = await sb
        .from('coupons')
        .select('*')
        .eq('store_id', storeId);

      if (couponErr) { setError('통계 데이터를 불러오지 못했습니다.'); setLoading(false); return; }

      const coupons: CouponStat[] = (couponData || []).map(c => ({ ...c, used_count: 0 }));

      // 사용 완료 수 집계
      if (coupons.length > 0) {
        const ids = coupons.map(c => c.id);
        const { data: usedData } = await sb
          .from('user_coupons')
          .select('coupon_id')
          .in('coupon_id', ids)
          .eq('status', 'used');
        // TODO: service role API route 필요 (RLS가 user_coupons 조회를 막을 경우)

        const usedMap: Record<string, number> = {};
        (usedData || []).forEach((r: { coupon_id: string }) => {
          usedMap[r.coupon_id] = (usedMap[r.coupon_id] || 0) + 1;
        });
        coupons.forEach(c => { c.used_count = usedMap[c.id] || 0; });
      }

      // 스탬프 고객 수
      const { data: stampData } = await sb
        .from('stamp_cards')
        .select('user_id')
        .eq('owner_id', session.user_id);
      // TODO: service role API route 필요 (RLS가 stamp_cards 조회를 막을 경우)

      const uniqueStampUsers = new Set((stampData || []).map((r: { user_id: string }) => r.user_id)).size;

      // KPI 집계
      const kpiData: KPI = {
        activeCoupons:  coupons.filter(c => c.is_active).length,
        totalIssued:    coupons.reduce((s, c) => s + c.issued_count, 0),
        totalUsed:      coupons.reduce((s, c) => s + c.used_count, 0),
        stampCustomers: uniqueStampUsers,
      };

      // 쿠폰 성과 — 사용률 높은 순 정렬
      const sorted = [...coupons].sort((a, b) => {
        const rateA = a.issued_count > 0 ? a.used_count / a.issued_count : 0;
        const rateB = b.issued_count > 0 ? b.used_count / b.issued_count : 0;
        return rateB - rateA;
      });

      setKpi(kpiData);
      setCouponStats(sorted);
      setLoading(false);
    };

    load();
  }, [session]);

  if (!session) return null;

  /* ── KPI 카드 정의 ── */
  const KPI_CARDS = kpi ? [
    { icon: Ticket,       label: '활성 쿠폰',    value: `${kpi.activeCoupons}개`,                  color: 'text-[#FF6F0F]',  bg: 'bg-[#FF6F0F]/10' },
    { icon: Send,         label: '총 발급',      value: `${kpi.totalIssued.toLocaleString()}장`,   color: 'text-blue-400',   bg: 'bg-blue-500/10'  },
    { icon: CheckCircle2, label: '사용 완료',    value: `${kpi.totalUsed.toLocaleString()}장`,     color: 'text-green-400',  bg: 'bg-green-500/10' },
    { icon: CreditCard,   label: '스탬프 고객',  value: `${kpi.stampCustomers.toLocaleString()}명`, color: 'text-purple-400', bg: 'bg-purple-500/10'},
  ] : [];

  /* ── 로딩 스켈레톤 ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border-main shrink-0">
          <div className="h-6 w-24 bg-fill-subtle rounded animate-pulse" />
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border-main rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* ── 빈 상태 ── */
  const isEmpty = !kpi || (kpi.totalIssued === 0 && kpi.stampCustomers === 0);

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main shrink-0">
        <h1 className="text-lg font-bold text-primary">통계</h1>
        <p className="text-xs text-muted mt-0.5">쿠폰 발급 및 스탬프 현황을 확인하세요.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted">
            <BarChart3 size={40} className="text-muted/30" />
            <p className="text-sm">아직 통계 데이터가 없어요</p>
            <p className="text-xs text-dim">쿠폰을 발급하거나 스탬프 적립이 시작되면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            {/* KPI 카드 2×2 */}
            <div className="grid grid-cols-2 gap-4">
              {KPI_CARDS.map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="bg-card border border-border-main rounded-xl p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{label}</p>
                    <p className="text-xl font-bold text-primary leading-tight mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 쿠폰별 성과 테이블 */}
            {couponStats.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-primary mb-3">쿠폰별 성과</h2>
                <div className="bg-card border border-border-main rounded-xl overflow-hidden">
                  {/* 테이블 헤더 */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-border-subtle bg-fill-subtle/50">
                    <span className="text-[11px] font-semibold text-muted">쿠폰</span>
                    <span className="text-[11px] font-semibold text-muted text-right">발급</span>
                    <span className="text-[11px] font-semibold text-muted text-right">사용</span>
                    <span className="text-[11px] font-semibold text-muted text-right">사용률</span>
                  </div>

                  {/* 쿠폰 행 */}
                  {couponStats.map((c, idx) => {
                    const rate = c.issued_count > 0
                      ? (c.used_count / c.issued_count) * 100
                      : 0;
                    const expired = new Date(c.expires_at) < new Date();

                    return (
                      <div
                        key={c.id}
                        className={`px-4 py-3 ${idx < couponStats.length - 1 ? 'border-b border-border-subtle' : ''}`}
                      >
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center mb-2">
                          {/* 쿠폰명 */}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary truncate">{c.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-[#FF6F0F]">{fmtDiscount(c.discount_type, c.discount_value)} 할인</span>
                              <span className="text-dim text-[10px]">·</span>
                              <span className={`text-[11px] ${expired ? 'text-red-400' : 'text-muted'}`}>
                                {expired ? '만료됨' : dDay(c.expires_at)}
                              </span>
                              <span className="text-dim text-[10px]">·</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                c.is_active
                                  ? 'text-green-400 bg-green-500/10'
                                  : 'text-muted bg-fill-subtle'
                              }`}>
                                {c.is_active ? '활성' : '비활성'}
                              </span>
                            </div>
                          </div>

                          {/* 발급 수 */}
                          <span className="text-sm font-semibold text-primary text-right tabular-nums">
                            {c.issued_count.toLocaleString()}
                          </span>

                          {/* 사용 수 */}
                          <span className="text-sm font-semibold text-primary text-right tabular-nums">
                            {c.used_count.toLocaleString()}
                          </span>

                          {/* 사용률 */}
                          <span className="text-sm font-bold text-right tabular-nums" style={{
                            color: rate >= 70 ? '#22c55e' : rate >= 30 ? '#FF6F0F' : undefined,
                          }}>
                            {rate.toFixed(1)}%
                          </span>
                        </div>

                        {/* 진행 바 */}
                        <div className="w-full h-1.5 bg-fill-subtle rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${rate}%`,
                              backgroundColor: rate >= 70 ? '#22c55e' : '#FF6F0F',
                            }}
                          />
                        </div>

                        {/* 발급 한도 바 */}
                        {c.total_quantity > 0 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-fill-subtle rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400/60 rounded-full"
                                style={{ width: `${Math.min(c.issued_count / c.total_quantity, 1) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-dim whitespace-nowrap">
                              {c.issued_count}/{c.total_quantity}장 발급
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
