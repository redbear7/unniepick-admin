'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Gift, Settings, RefreshCw, ToggleLeft, ToggleRight,
  Clock, Repeat, Coins, FileText, Star, Image as ImageIcon,
} from 'lucide-react';

// ── 타입 ──────────────────────────────────────────────────────────────
interface PointSetting {
  enabled:                    boolean;
  amount:                     number;
  max_per_day:                number;
  receipt_max_age_hours:      number;
  max_consecutive_per_store:  number;
  max_total_per_store:        number;
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

interface ReviewRow {
  id:             string;
  user_id:        string;
  store_id:       string | null;
  content:        string;
  photo_url:      string | null;
  receipt_date:   string | null;
  points_awarded: number;
  status:         string;
  created_at:     string;
  profiles:       { nickname: string | null } | null;
  stores:         { name: string; emoji: string | null } | null;
}

type MainTab = 'reviews' | 'settings' | 'history';

// ── 메인 ──────────────────────────────────────────────────────────────
export default function PointsPage() {
  const supabase = createClient();

  const [tab,       setTab]       = useState<MainTab>('reviews');
  const [setting,   setSetting]   = useState<PointSetting>({
    enabled: true, amount: 500, max_per_day: 1, receipt_max_age_hours: 48,
    max_consecutive_per_store: 1, max_total_per_store: 1,
  });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState<string | null>(null);
  const [txList,    setTxList]    = useState<TxRow[]>([]);
  const [reviews,   setReviews]   = useState<ReviewRow[]>([]);
  const [revLoading, setRevLoading] = useState(true);
  const [stats,     setStats]     = useState({ today: 0, total: 0, totalReviews: 0 });

  useEffect(() => { loadSetting(); loadTx(); loadReviews(); loadStats(); }, []);

  // ── 설정 로드 ─────────────────────────────────────────────────────
  const loadSetting = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('point_settings').select('value').eq('key', 'receipt_review').single();
    if (data?.value) setSetting(data.value as PointSetting);
    setLoading(false);
  };

  // ── 리뷰 목록 ─────────────────────────────────────────────────────
  const loadReviews = async () => {
    setRevLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('id, user_id, store_id, content, photo_url, receipt_date, points_awarded, status, created_at, profiles(nickname), stores(name, emoji)')
      .order('created_at', { ascending: false })
      .limit(100);
    setReviews((data ?? []) as ReviewRow[]);
    setRevLoading(false);
  };

  // ── 트랜잭션 로드 ─────────────────────────────────────────────────
  const loadTx = async () => {
    const { data } = await supabase
      .from('point_transactions')
      .select('id, user_id, amount, type, description, created_at, profiles(nickname)')
      .order('created_at', { ascending: false })
      .limit(50);
    setTxList((data ?? []) as TxRow[]);
  };

  // ── 통계 ─────────────────────────────────────────────────────────
  const loadStats = async () => {
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const [{ count: today }, { count: total }, { count: totalReviews }] = await Promise.all([
      supabase.from('point_transactions').select('id', { count: 'exact', head: true })
        .eq('type', 'receipt_review').gte('created_at', since24h),
      supabase.from('point_transactions').select('id', { count: 'exact', head: true })
        .eq('type', 'receipt_review'),
      supabase.from('reviews').select('id', { count: 'exact', head: true }),
    ]);
    setStats({ today: today ?? 0, total: total ?? 0, totalReviews: totalReviews ?? 0 });
  };

  // ── 리뷰 숨김/복원 ───────────────────────────────────────────────
  const toggleReviewStatus = async (id: string, current: string) => {
    const next = current === 'active' ? 'hidden' : 'active';
    await supabase.from('reviews').update({ status: next }).eq('id', id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status: next } : r));
  };

  // ── 저장 (service_role API Route 경유) ───────────────────────────
  const save = async () => {
    setSaving(true); setSaveMsg(null);
    const res = await fetch('/api/admin/point-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'receipt_review',
        value: setting,
        description: '영수증 후기 제보 포인트 지급 조건',
      }),
    });
    const json = await res.json();
    setSaving(false);
    setSaveMsg(json.ok ? '✅ 저장됐어요.' : `❌ ${json.error}`);
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const numInput = (val: number, onChange: (n: number) => void, min = 1) => (
    <input type="number" min={min} value={val}
      onChange={e => onChange(Math.max(min, parseInt(e.target.value) || min))}
      className="w-28 px-3 py-2 rounded-lg bg-surface border border-border-main text-primary text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6F0F]/50"
    />
  );

  const refresh = () => { loadTx(); loadReviews(); loadStats(); };

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6F0F]/15 flex items-center justify-center">
            <Gift size={20} className="text-[#FF6F0F]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">영수증 리뷰</h1>
            <p className="text-sm text-muted">방문 후기 관리 및 포인트 지급 조건 설정</p>
          </div>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border-main text-sm text-muted hover:text-primary transition">
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '총 리뷰 수',     value: stats.totalReviews, unit: '건', color: 'text-[#FF6F0F]' },
          { label: '오늘 포인트 지급', value: stats.today,       unit: '건', color: 'text-blue-400'  },
          { label: '총 포인트 지급',  value: stats.total,       unit: '건', color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border-main rounded-xl p-4">
            <p className="text-xs text-muted mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>
              {s.value.toLocaleString()}<span className="text-sm text-muted font-normal ml-1">{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-card border border-border-main rounded-xl p-1">
        {([
          { key: 'reviews',  label: '📝 리뷰 목록'  },
          { key: 'settings', label: '⚙️ 포인트 설정' },
          { key: 'history',  label: '📋 지급 내역'   },
        ] as { key: MainTab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.key ? 'bg-[#FF6F0F] text-white' : 'text-muted hover:text-primary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭: 리뷰 목록 ── */}
      {tab === 'reviews' && (
        <div className="bg-card border border-border-main rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-main">
            <h2 className="font-bold text-primary">영수증 후기 목록</h2>
          </div>
          {revLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#FF6F0F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-14 text-center text-muted text-sm">등록된 후기가 없어요</div>
          ) : (
            <div className="divide-y divide-border-main">
              {reviews.map(r => (
                <div key={r.id} className={`px-6 py-4 hover:bg-surface transition ${r.status === 'hidden' ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* 사진 */}
                    {r.photo_url ? (
                      <img src={r.photo_url} alt="후기 사진"
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-border-main" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-surface border border-border-main flex items-center justify-center shrink-0">
                        <ImageIcon size={20} className="text-muted" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* 상단: 닉네임 + 가게 + 날짜 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-primary">
                          {r.profiles?.nickname ?? '사용자'}
                        </span>
                        {r.stores && (
                          <span className="px-2 py-0.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] text-xs font-semibold">
                            {r.stores.emoji ?? ''} {r.stores.name}
                          </span>
                        )}
                        {!r.stores && r.store_id && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-muted text-xs">미등록 업체</span>
                        )}
                        <span className="text-xs text-muted ml-auto">
                          {new Date(r.created_at).toLocaleDateString('ko-KR', {
                            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* 후기 본문 */}
                      <p className="text-sm text-primary leading-relaxed">{r.content}</p>

                      {/* 하단: 영수증 날짜 + 포인트 + 상태 */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {r.receipt_date && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Clock size={10} /> {r.receipt_date}
                          </span>
                        )}
                        {r.points_awarded > 0 && (
                          <span className="text-xs font-bold text-green-400">
                            +{r.points_awarded.toLocaleString()}P 지급
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          r.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {r.status === 'active' ? '공개' : '숨김'}
                        </span>
                        <button onClick={() => toggleReviewStatus(r.id, r.status)}
                          className="text-xs text-muted hover:text-primary underline transition ml-auto">
                          {r.status === 'active' ? '숨기기' : '공개'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 포인트 설정 ── */}
      {tab === 'settings' && (
        <div className="bg-card border border-border-main rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-muted" />
            <h2 className="font-bold text-primary">영수증 후기 포인트 조건</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#FF6F0F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 활성화 */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
                <div>
                  <p className="font-semibold text-primary text-sm">포인트 지급 활성화</p>
                  <p className="text-xs text-muted mt-0.5">비활성화 시 조건 충족해도 포인트 미지급</p>
                </div>
                <button onClick={() => setSetting(p => ({ ...p, enabled: !p.enabled }))}>
                  {setting.enabled
                    ? <ToggleRight size={36} className="text-[#FF6F0F]" />
                    : <ToggleLeft  size={36} className="text-muted" />}
                </button>
              </div>
              {/* 포인트 */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
                <div className="flex items-center gap-3">
                  <Coins size={16} className="text-[#FF6F0F]" />
                  <div>
                    <p className="font-semibold text-primary text-sm">지급 포인트</p>
                    <p className="text-xs text-muted">후기 1건 제출 시 지급</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {numInput(setting.amount, v => setSetting(p => ({ ...p, amount: v })))}
                  <span className="text-sm text-muted">P</span>
                </div>
              </div>
              {/* 일일 횟수 */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
                <div className="flex items-center gap-3">
                  <Repeat size={16} className="text-blue-400" />
                  <div>
                    <p className="font-semibold text-primary text-sm">일일 최대 지급 횟수</p>
                    <p className="text-xs text-muted">사용자 1명 · 하루 기준</p>
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
                  <Clock size={16} className="text-green-400" />
                  <div>
                    <p className="font-semibold text-primary text-sm">영수증 유효 시간</p>
                    <p className="text-xs text-muted">발행일 초과 시 포인트 미지급</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {numInput(setting.receipt_max_age_hours, v => setSetting(p => ({ ...p, receipt_max_age_hours: v })))}
                  <span className="text-sm text-muted">시간 이내</span>
                </div>
              </div>
              {/* 동일 매장 연속 리뷰 */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
                <div className="flex items-center gap-3">
                  <Repeat size={16} className="text-orange-400" />
                  <div>
                    <p className="font-semibold text-primary text-sm">동일 매장 연속 리뷰 제한</p>
                    <p className="text-xs text-muted">같은 매장에 연속으로 작성 가능한 최대 횟수<br/>초과 시 다른 매장 후기 작성 후 재등록 가능</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {numInput(setting.max_consecutive_per_store, v => setSetting(p => ({ ...p, max_consecutive_per_store: v })))}
                  <span className="text-sm text-muted">회</span>
                </div>
              </div>

              {/* 동일 매장 총 리뷰 */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border-main">
                <div className="flex items-center gap-3">
                  <Star size={16} className="text-yellow-400" />
                  <div>
                    <p className="font-semibold text-primary text-sm">동일 매장 최대 리뷰 수</p>
                    <p className="text-xs text-muted">한 사용자가 같은 매장에 작성할 수 있는 전체 최대 횟수</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {numInput(setting.max_total_per_store, v => setSetting(p => ({ ...p, max_total_per_store: v })))}
                  <span className="text-sm text-muted">회</span>
                </div>
              </div>

              {/* 요약 */}
              <div className="px-4 py-3 rounded-xl bg-[#FF6F0F]/8 border border-[#FF6F0F]/20 text-sm text-primary">
                <span className="font-semibold text-[#FF6F0F]">현재 설정: </span>
                {setting.enabled ? '✅ 활성' : '❌ 비활성'} —
                영수증 발행 <strong>{setting.receipt_max_age_hours}시간</strong> 이내 ·
                하루 최대 <strong>{setting.max_per_day}회</strong> ·
                동일 매장 연속 <strong>{setting.max_consecutive_per_store}회</strong> ·
                동일 매장 총 <strong>{setting.max_total_per_store}회</strong> →
                <strong className="text-[#FF6F0F]"> {setting.amount.toLocaleString()}P</strong> 지급
              </div>
              <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FF6F0F] text-white text-sm font-bold hover:bg-[#e55f00] transition disabled:opacity-50">
                  {saving
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Gift size={15} />}
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
      )}

      {/* ── 탭: 지급 내역 ── */}
      {tab === 'history' && (
        <div className="bg-card border border-border-main rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-main flex items-center justify-between">
            <h2 className="font-bold text-primary">포인트 지급 내역</h2>
            <span className="text-xs text-muted">최근 50건</span>
          </div>
          {txList.length === 0 ? (
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
                      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <span className={`text-sm font-bold shrink-0 w-20 text-right ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}P
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
