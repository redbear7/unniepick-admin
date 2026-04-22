'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Gift, Settings, RefreshCw, ToggleLeft, ToggleRight, Clock, Repeat, Coins } from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────────
interface PointSetting {
  enabled:               boolean;
  amount:                number;
  max_per_day:           number;
  receipt_max_age_hours: number;
}

interface TxRow {
  id:          string;
  user_id:     string;
  amount:      number;
  type:        string;
  description: string | null;
  created_at:  string;
  profiles:    { nickname: string | null } | null;
}

// ── 메인 ──────────────────────────────────────────────────────────────
export default function PointsPage() {
  const supabase = createClient();

  const [setting,   setSetting]   = useState<PointSetting>({
    enabled: true, amount: 500, max_per_day: 1, receipt_max_age_hours: 48,
  });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState<string | null>(null);
  const [txList,    setTxList]    = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [stats,     setStats]     = useState({ today: 0, total: 0, totalUsers: 0 });

  useEffect(() => { loadSetting(); loadTx(); loadStats(); }, []);

  // ── 설정 불러오기 ─────────────────────────────────────────────────
  const loadSetting = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('point_settings')
      .select('value')
      .eq('key', 'receipt_review')
      .single();
    if (data?.value) setSetting(data.value as PointSetting);
    setLoading(false);
  };

  // ── 최근 트랜잭션 ─────────────────────────────────────────────────
  const loadTx = async () => {
    setTxLoading(true);
    const { data } = await supabase
      .from('point_transactions')
      .select('id, user_id, amount, type, description, created_at, profiles(nickname)')
      .order('created_at', { ascending: false })
      .limit(50);
    setTxList((data ?? []) as TxRow[]);
    setTxLoading(false);
  };

  // ── 통계 ─────────────────────────────────────────────────────────
  const loadStats = async () => {
    const since24h = new Date(Date.now() - 86400000).toISOString();

    const [{ count: today }, { count: total }, { count: users }] = await Promise.all([
      supabase.from('point_transactions').select('id', { count: 'exact', head: true })
        .eq('type', 'receipt_review').gte('created_at', since24h),
      supabase.from('point_transactions').select('id', { count: 'exact', head: true })
        .eq('type', 'receipt_review'),
      supabase.from('point_transactions').select('user_id', { count: 'exact', head: true })
        .eq('type', 'receipt_review'),
    ]);
    setStats({ today: today ?? 0, total: total ?? 0, totalUsers: users ?? 0 });
  };

  // ── 저장 ─────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from('point_settings')
      .upsert({
        key:         'receipt_review',
        value:       setting,
        description: '영수증 후기 제보 포인트 지급 조건',
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'key' });

    setSaving(false);
    setSaveMsg(error ? `❌ 저장 실패: ${error.message}` : '✅ 저장됐어요.');
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const numInput = (
    val: number,
    onChange: (n: number) => void,
    min = 1,
  ) => (
    <input
      type="number"
      min={min}
      value={val}
      onChange={e => onChange(Math.max(min, parseInt(e.target.value) || min))}
      className="w-28 px-3 py-2 rounded-lg bg-surface border border-border-main text-primary text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6F0F]/50"
    />
  );

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6F0F]/15 flex items-center justify-center">
            <Gift size={20} className="text-[#FF6F0F]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">포인트 설정</h1>
            <p className="text-sm text-muted">영수증 후기 제보 포인트 지급 조건을 관리해요</p>
          </div>
        </div>
        <button
          onClick={() => { loadTx(); loadStats(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border-main text-sm text-muted hover:text-primary transition"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '오늘 지급 건수',   value: stats.today,       unit: '건',  color: 'text-[#FF6F0F]' },
          { label: '총 지급 건수',     value: stats.total,       unit: '건',  color: 'text-blue-400' },
          { label: '수령 회원 수',     value: stats.totalUsers,  unit: '명',  color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border-main rounded-xl p-4">
            <p className="text-xs text-muted mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>
              {s.value.toLocaleString()}
              <span className="text-sm text-muted font-normal ml-1">{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 설정 카드 */}
      <div className="bg-card border border-border-main rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-muted" />
          <h2 className="font-bold text-primary">영수증 후기 포인트 조건</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#FF6F0F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* 활성화 토글 */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
              <div>
                <p className="font-semibold text-primary text-sm">포인트 지급 활성화</p>
                <p className="text-xs text-muted mt-0.5">비활성화 시 조건 충족해도 포인트가 지급되지 않아요</p>
              </div>
              <button
                onClick={() => setSetting(p => ({ ...p, enabled: !p.enabled }))}
                className="transition"
              >
                {setting.enabled
                  ? <ToggleRight size={36} className="text-[#FF6F0F]" />
                  : <ToggleLeft  size={36} className="text-muted" />
                }
              </button>
            </div>

            {/* 지급 포인트 */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
              <div className="flex items-center gap-3">
                <Coins size={16} className="text-[#FF6F0F] shrink-0" />
                <div>
                  <p className="font-semibold text-primary text-sm">지급 포인트</p>
                  <p className="text-xs text-muted mt-0.5">후기 1건 제출 시 지급할 포인트</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {numInput(setting.amount, v => setSetting(p => ({ ...p, amount: v })))}
                <span className="text-sm text-muted">P</span>
              </div>
            </div>

            {/* 일일 최대 횟수 */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
              <div className="flex items-center gap-3">
                <Repeat size={16} className="text-blue-400 shrink-0" />
                <div>
                  <p className="font-semibold text-primary text-sm">일일 최대 지급 횟수</p>
                  <p className="text-xs text-muted mt-0.5">사용자 1명이 하루에 받을 수 있는 최대 횟수</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {numInput(setting.max_per_day, v => setSetting(p => ({ ...p, max_per_day: v })))}
                <span className="text-sm text-muted">회/일</span>
              </div>
            </div>

            {/* 영수증 유효 시간 */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-green-400 shrink-0" />
                <div>
                  <p className="font-semibold text-primary text-sm">영수증 유효 시간</p>
                  <p className="text-xs text-muted mt-0.5">발행일로부터 이 시간이 지난 영수증은 포인트 지급 불가</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {numInput(setting.receipt_max_age_hours, v => setSetting(p => ({ ...p, receipt_max_age_hours: v })))}
                <span className="text-sm text-muted">시간 이내</span>
              </div>
            </div>

            {/* 요약 */}
            <div className="px-4 py-3 rounded-xl bg-[#FF6F0F]/8 border border-[#FF6F0F]/20 text-sm text-primary">
              <span className="font-semibold text-[#FF6F0F]">현재 설정: </span>
              {setting.enabled ? '✅ 활성' : '❌ 비활성'} —
              영수증 발행 <span className="font-semibold">{setting.receipt_max_age_hours}시간</span> 이내,
              하루 최대 <span className="font-semibold">{setting.max_per_day}회</span>,
              <span className="font-semibold text-[#FF6F0F]"> {setting.amount.toLocaleString()}P</span> 지급
            </div>

            {/* 저장 버튼 */}
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FF6F0F] text-white text-sm font-bold hover:bg-[#e55f00] transition disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Gift size={15} />
                )}
                설정 저장
              </button>
              {saveMsg && (
                <span className={`text-sm font-medium ${saveMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 최근 지급 내역 */}
      <div className="bg-card border border-border-main rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border-main flex items-center justify-between">
          <h2 className="font-bold text-primary">최근 지급 내역</h2>
          <span className="text-xs text-muted">최근 50건</span>
        </div>

        {txLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#FF6F0F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : txList.length === 0 ? (
          <div className="py-14 text-center text-muted text-sm">지급 내역이 없어요</div>
        ) : (
          <div className="divide-y divide-border-main">
            {txList.map(tx => (
              <div key={tx.id} className="flex items-center gap-4 px-6 py-3 hover:bg-surface transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">
                    {tx.profiles?.nickname ?? '사용자'}
                  </p>
                  <p className="text-xs text-muted truncate mt-0.5">{tx.description ?? tx.type}</p>
                </div>
                <p className="text-xs text-muted shrink-0">
                  {new Date(tx.created_at).toLocaleDateString('ko-KR', {
                    month: 'numeric', day: 'numeric',
                    hour:  '2-digit', minute: '2-digit',
                  })}
                </p>
                <span className={`text-sm font-bold shrink-0 w-20 text-right ${
                  tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}P
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
