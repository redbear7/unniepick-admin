'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useOwnerSession } from '@/components/OwnerShell';
import {
  Ticket, Send, CheckCircle2, Users,
  BarChart3, Star, RefreshCcw, TrendingUp,
  UserCheck, Footprints,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type TargetSegment = 'all' | 'new' | 'returning';

interface CouponStat {
  id: string;
  title: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  total_quantity: number;
  issued_count: number;
  is_active: boolean;
  expires_at: string;
  target_segment: TargetSegment | null;
  min_visit_count: number | null;
  used_count: number;
}

interface VisitRow {
  visited_at: string;
  user_id: string;
}

interface KPI {
  activeCoupons:    number;
  totalIssued:      number;
  totalUsed:        number;
  usageRate:        number;
  totalVisitors:    number;   // store_visits 고유 사용자
  newVisitors:      number;   // 1회만 방문한 사용자
  returningVisitors:number;
  thisMonthVisitors:number;
  stampCustomers:   number;
}

/* ------------------------------------------------------------------ */
/* 유틸                                                                  */
/* ------------------------------------------------------------------ */

function fmtDiscount(type: 'percent' | 'amount', value: number): string {
  return type === 'percent' ? `${value}%` : `${value.toLocaleString()}원`;
}

function dDay(iso: string): string {
  const diff = new Date(iso).setHours(23, 59, 59, 999) - Date.now();
  if (diff < 0) return '만료됨';
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days === 0 ? '오늘 만료' : `D-${days}`;
}

const SEG_LABEL: Record<TargetSegment, string> = {
  all: '전체',
  new: '신규',
  returning: '재방문',
};
const SEG_COLOR: Record<TargetSegment, { text: string; bg: string; border: string }> = {
  all:       { text: 'text-muted',      bg: 'bg-fill-subtle',     border: 'border-border-subtle' },
  new:       { text: 'text-emerald-400',bg: 'bg-emerald-500/15',  border: 'border-emerald-500/25' },
  returning: { text: 'text-blue-400',   bg: 'bg-blue-500/15',     border: 'border-blue-500/25' },
};

/* 세그먼트별 성과 집계 */
function segmentPerf(coupons: CouponStat[], seg: TargetSegment | 'all') {
  const list = seg === 'all' ? coupons : coupons.filter(c => (c.target_segment ?? 'all') === seg);
  const issued = list.reduce((s, c) => s + c.issued_count, 0);
  const used   = list.reduce((s, c) => s + c.used_count,   0);
  const rate   = issued > 0 ? (used / issued) * 100 : 0;
  return { count: list.length, issued, used, rate };
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function OwnerStatsPage() {
  const { session } = useOwnerSession();
  const [kpi,         setKpi]         = useState<KPI | null>(null);
  const [couponStats, setCouponStats] = useState<CouponStat[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (!session) return;

    const load = async () => {
      const sb = createClient();

      /* ── 가게 ID ── */
      const { data: storeData } = await sb
        .from('stores').select('id').eq('owner_id', session.user_id).maybeSingle();
      if (!storeData) { setLoading(false); return; }
      const storeId = storeData.id;

      /* ── 쿠폰 조회 ── */
      const { data: couponData, error: couponErr } = await sb
        .from('coupons')
        .select('id, title, discount_type, discount_value, total_quantity, issued_count, is_active, expires_at, target_segment, min_visit_count')
        .eq('store_id', storeId);

      if (couponErr) { setError('통계 데이터를 불러오지 못했습니다.'); setLoading(false); return; }

      const coupons: CouponStat[] = (couponData || []).map(c => ({ ...c, used_count: 0 }));

      /* ── 사용 완료 수 집계 ── */
      if (coupons.length > 0) {
        const { data: usedData } = await sb
          .from('user_coupons').select('coupon_id')
          .in('coupon_id', coupons.map(c => c.id))
          .eq('status', 'used');
        const usedMap: Record<string, number> = {};
        (usedData || []).forEach((r: { coupon_id: string }) => {
          usedMap[r.coupon_id] = (usedMap[r.coupon_id] || 0) + 1;
        });
        coupons.forEach(c => { c.used_count = usedMap[c.id] || 0; });
      }

      /* ── 방문 데이터 ── */
      const { data: visitData } = await sb
        .from('store_visits')
        .select('user_id, visited_at')
        .eq('store_id', storeId);

      const visits: VisitRow[] = visitData || [];

      // 고유 방문자 집계
      const visitorCountMap = new Map<string, number>();
      visits.forEach(v => {
        visitorCountMap.set(v.user_id, (visitorCountMap.get(v.user_id) ?? 0) + 1);
      });
      const totalVisitors     = visitorCountMap.size;
      const newVisitors       = [...visitorCountMap.values()].filter(n => n === 1).length;
      const returningVisitors = totalVisitors - newVisitors;

      // 이번 달 방문자
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);
      const thisMonthVisitorSet = new Set(
        visits.filter(v => new Date(v.visited_at) >= thisMonthStart).map(v => v.user_id)
      );

      /* ── 스탬프 고객 ── */
      const { data: stampData } = await sb
        .from('stamp_cards').select('user_id').eq('store_id', storeId);
      const stampCustomers = new Set((stampData || []).map((r: { user_id: string }) => r.user_id)).size;

      /* ── KPI 집계 ── */
      const totalIssued = coupons.reduce((s, c) => s + c.issued_count, 0);
      const totalUsed   = coupons.reduce((s, c) => s + c.used_count, 0);

      setKpi({
        activeCoupons:     coupons.filter(c => c.is_active).length,
        totalIssued,
        totalUsed,
        usageRate:         totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0,
        totalVisitors,
        newVisitors,
        returningVisitors,
        thisMonthVisitors: thisMonthVisitorSet.size,
        stampCustomers,
      });

      /* ── 쿠폰 성과: 사용률 높은 순 ── */
      setCouponStats(
        [...coupons].sort((a, b) => {
          const rA = a.issued_count > 0 ? a.used_count / a.issued_count : 0;
          const rB = b.issued_count > 0 ? b.used_count / b.issued_count : 0;
          return rB - rA;
        })
      );

      setLoading(false);
    };

    load();
  }, [session]);

  if (!session) return null;

  /* ── 로딩 스켈레톤 ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border-main shrink-0">
          <div className="h-6 w-24 bg-fill-subtle rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border-main rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !kpi || (kpi.totalIssued === 0 && kpi.totalVisitors === 0);

  /* ── 세그먼트 성과 ── */
  const segAll  = segmentPerf(couponStats, 'all');
  const segNew  = segmentPerf(couponStats, 'new');
  const segRet  = segmentPerf(couponStats, 'returning');

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main shrink-0">
        <h1 className="text-lg font-bold text-primary">통계</h1>
        <p className="text-xs text-muted mt-0.5">쿠폰 성과 및 방문 고객 현황을 확인하세요.</p>
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
            <p className="text-xs text-dim text-center">
              쿠폰을 발급하거나 고객이 방문하면 여기에 표시됩니다.
            </p>
          </div>
        ) : kpi && (
          <div className="max-w-2xl space-y-6">

            {/* ── 섹션 1: 쿠폰 핵심 KPI ── */}
            <section>
              <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">쿠폰 현황</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: Ticket,
                    label: '활성 쿠폰',
                    value: `${kpi.activeCoupons}개`,
                    color: 'text-[#FF6F0F]', bg: 'bg-[#FF6F0F]/10',
                  },
                  {
                    icon: TrendingUp,
                    label: '전체 사용률',
                    value: `${kpi.usageRate.toFixed(1)}%`,
                    color: kpi.usageRate >= 60 ? 'text-emerald-400' : kpi.usageRate >= 30 ? 'text-[#FF6F0F]' : 'text-muted',
                    bg:    kpi.usageRate >= 60 ? 'bg-emerald-500/10' : kpi.usageRate >= 30 ? 'bg-[#FF6F0F]/10' : 'bg-fill-subtle',
                    sub:   `${kpi.totalUsed.toLocaleString()} / ${kpi.totalIssued.toLocaleString()}장`,
                  },
                  {
                    icon: Send,
                    label: '총 발급',
                    value: `${kpi.totalIssued.toLocaleString()}장`,
                    color: 'text-blue-400', bg: 'bg-blue-500/10',
                  },
                  {
                    icon: CheckCircle2,
                    label: '사용 완료',
                    value: `${kpi.totalUsed.toLocaleString()}장`,
                    color: 'text-green-400', bg: 'bg-green-500/10',
                  },
                ].map(({ icon: Icon, label, value, color, bg, sub }) => (
                  <div key={label} className="bg-card border border-border-main rounded-xl p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted">{label}</p>
                      <p className={`text-lg font-bold leading-tight mt-0.5 ${color}`}>{value}</p>
                      {sub && <p className="text-[10px] text-dim mt-0.5">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 섹션 2: 방문 고객 현황 ── */}
            <section>
              <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">방문 고객</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: Users,
                    label: '전체 방문 고객',
                    value: `${kpi.totalVisitors.toLocaleString()}명`,
                    color: 'text-purple-400', bg: 'bg-purple-500/10',
                    sub: `이번 달 ${kpi.thisMonthVisitors}명`,
                  },
                  {
                    icon: Footprints,
                    label: '스탬프 고객',
                    value: `${kpi.stampCustomers.toLocaleString()}명`,
                    color: 'text-amber-400', bg: 'bg-amber-500/10',
                  },
                  {
                    icon: Star,
                    label: '신규 고객',
                    value: `${kpi.newVisitors.toLocaleString()}명`,
                    color: 'text-emerald-400', bg: 'bg-emerald-500/10',
                    sub: kpi.totalVisitors > 0
                      ? `전체의 ${Math.round(kpi.newVisitors / kpi.totalVisitors * 100)}%`
                      : undefined,
                  },
                  {
                    icon: RefreshCcw,
                    label: '재방문 고객',
                    value: `${kpi.returningVisitors.toLocaleString()}명`,
                    color: 'text-blue-400', bg: 'bg-blue-500/10',
                    sub: kpi.totalVisitors > 0
                      ? `전체의 ${Math.round(kpi.returningVisitors / kpi.totalVisitors * 100)}%`
                      : undefined,
                  },
                ].map(({ icon: Icon, label, value, color, bg, sub }) => (
                  <div key={label} className="bg-card border border-border-main rounded-xl p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted">{label}</p>
                      <p className={`text-lg font-bold leading-tight mt-0.5 ${color}`}>{value}</p>
                      {sub && <p className="text-[10px] text-dim mt-0.5">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* 신규 vs 재방문 비율 바 */}
              {kpi.totalVisitors > 0 && (
                <div className="mt-3 bg-card border border-border-main rounded-xl p-4">
                  <div className="flex items-center justify-between text-[11px] text-muted mb-2">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Star size={10} /> 신규 {Math.round(kpi.newVisitors / kpi.totalVisitors * 100)}%
                    </span>
                    <span className="flex items-center gap-1 text-blue-400 font-semibold">
                      재방문 {Math.round(kpi.returningVisitors / kpi.totalVisitors * 100)}% <RefreshCcw size={10} />
                    </span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 transition-all"
                      style={{ width: `${kpi.newVisitors / kpi.totalVisitors * 100}%` }}
                    />
                    <div
                      className="bg-blue-400 transition-all"
                      style={{ width: `${kpi.returningVisitors / kpi.totalVisitors * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ── 섹션 3: 세그먼트별 쿠폰 성과 비교 ── */}
            {couponStats.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                  대상별 쿠폰 성과
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { seg: 'all'       as TargetSegment, label: '전체',   icon: <Ticket size={13} />,      perf: segAll },
                    { seg: 'new'       as TargetSegment, label: '신규',   icon: <Star size={13} />,        perf: segNew },
                    { seg: 'returning' as TargetSegment, label: '재방문', icon: <RefreshCcw size={13} />,  perf: segRet },
                  ]).map(({ seg, label, icon, perf }) => {
                    const col = SEG_COLOR[seg];
                    return (
                      <div key={seg} className={`rounded-xl border p-3 ${col.bg} ${col.border}`}>
                        <div className={`flex items-center gap-1.5 mb-2 ${col.text} text-[11px] font-bold`}>
                          {icon} {label}
                        </div>
                        <p className={`text-xl font-bold ${col.text}`}>
                          {perf.rate.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-dim mt-0.5">사용률</p>
                        <div className="mt-2 space-y-0.5 text-[10px] text-muted">
                          <p>쿠폰 {perf.count}개</p>
                          <p>발급 {perf.issued} / 사용 {perf.used}</p>
                        </div>
                        {/* 사용률 바 */}
                        <div className="mt-2 h-1 bg-black/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full opacity-70"
                            style={{
                              width: `${Math.min(perf.rate, 100)}%`,
                              backgroundColor: seg === 'new' ? '#34d399' : seg === 'returning' ? '#60a5fa' : '#FF6F0F',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── 섹션 4: 쿠폰별 상세 성과 ── */}
            {couponStats.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                  쿠폰별 상세 성과
                </h2>
                <div className="bg-card border border-border-main rounded-xl overflow-hidden">
                  {/* 헤더 */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-border-subtle bg-fill-subtle/50">
                    <span className="text-[11px] font-semibold text-muted">쿠폰</span>
                    <span className="text-[11px] font-semibold text-muted text-right">발급</span>
                    <span className="text-[11px] font-semibold text-muted text-right">사용</span>
                    <span className="text-[11px] font-semibold text-muted text-right">사용률</span>
                  </div>

                  {couponStats.map((c, idx) => {
                    const rate    = c.issued_count > 0 ? (c.used_count / c.issued_count) * 100 : 0;
                    const expired = new Date(c.expires_at) < new Date();
                    const seg     = c.target_segment ?? 'all';
                    const col     = SEG_COLOR[seg];

                    return (
                      <div
                        key={c.id}
                        className={`px-4 py-3 ${idx < couponStats.length - 1 ? 'border-b border-border-subtle' : ''}`}
                      >
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-start mb-2">
                          {/* 쿠폰명 + 메타 */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <p className="text-sm font-medium text-primary truncate">{c.title}</p>
                              {/* 세그먼트 뱃지 */}
                              {seg !== 'all' && (
                                <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${col.bg} ${col.text} ${col.border}`}>
                                  {seg === 'new'
                                    ? <><Star size={8}/> {SEG_LABEL[seg]}</>
                                    : <><RefreshCcw size={8}/> {SEG_LABEL[seg]}{c.min_visit_count ? ` ${c.min_visit_count}회↑` : ''}</>
                                  }
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] text-[#FF6F0F]">
                                {fmtDiscount(c.discount_type, c.discount_value)} 할인
                              </span>
                              <span className="text-dim text-[10px]">·</span>
                              <span className={`text-[11px] ${expired ? 'text-red-400' : 'text-muted'}`}>
                                {expired ? '만료됨' : dDay(c.expires_at)}
                              </span>
                              <span className="text-dim text-[10px]">·</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                c.is_active ? 'text-green-400 bg-green-500/10' : 'text-muted bg-fill-subtle'
                              }`}>
                                {c.is_active ? '활성' : '비활성'}
                              </span>
                            </div>
                          </div>

                          {/* 발급 */}
                          <span className="text-sm font-semibold text-primary text-right tabular-nums">
                            {c.issued_count.toLocaleString()}
                          </span>
                          {/* 사용 */}
                          <span className="text-sm font-semibold text-primary text-right tabular-nums">
                            {c.used_count.toLocaleString()}
                          </span>
                          {/* 사용률 */}
                          <span
                            className="text-sm font-bold text-right tabular-nums"
                            style={{ color: rate >= 70 ? '#22c55e' : rate >= 30 ? '#FF6F0F' : undefined }}
                          >
                            {rate.toFixed(1)}%
                          </span>
                        </div>

                        {/* 사용률 바 */}
                        <div className="w-full h-1.5 bg-fill-subtle rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${rate}%`,
                              backgroundColor:
                                seg === 'new'       ? '#34d399' :
                                seg === 'returning' ? '#60a5fa' :
                                rate >= 70          ? '#22c55e' : '#FF6F0F',
                            }}
                          />
                        </div>

                        {/* 발급 한도 바 */}
                        {c.total_quantity > 0 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-fill-subtle rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400/50 rounded-full"
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
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
