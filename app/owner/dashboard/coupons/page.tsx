'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useOwnerSession } from '@/components/OwnerShell';
import {
  Ticket, Plus, X, Check, Loader2, AlertCircle, Trash2,
} from 'lucide-react';

interface Coupon {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  total_quantity: number;
  issued_count: number;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  used_count?: number;
}

interface CouponForm {
  title: string;
  description: string;
  discount_type: 'percent' | 'amount';
  discount_value: string;
  total_quantity: string;
  expires_at: string;
}

const EMPTY_FORM: CouponForm = {
  title: '',
  description: '',
  discount_type: 'percent',
  discount_value: '',
  total_quantity: '',
  expires_at: '',
};

function dDay(iso: string): string {
  const diff = new Date(iso).setHours(23, 59, 59, 999) - Date.now();
  if (diff < 0) return '만료됨';
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days === 0 ? '오늘 만료' : `D-${days}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '');
}

function fmtDiscount(type: 'percent' | 'amount', value: number): string {
  return type === 'percent'
    ? `${value}%`
    : `${value.toLocaleString()}원`;
}

export default function OwnerCouponsPage() {
  const { session } = useOwnerSession();
  const [storeId,   setStoreId]   = useState<string | null>(null);
  const [coupons,   setCoupons]   = useState<Coupon[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState<CouponForm>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  /* ── 가게 ID 조회 후 쿠폰 목록 로드 ── */
  const loadData = async (uid: string) => {
    const sb = createClient();

    // storeId 조회
    const { data: storeData } = await sb
      .from('stores')
      .select('id')
      .eq('owner_id', uid)
      .maybeSingle();

    if (!storeData) { setLoading(false); return; }
    setStoreId(storeData.id);

    // 쿠폰 조회
    const { data: couponData, error: couponErr } = await sb
      .from('coupons')
      .select('*')
      .eq('store_id', storeData.id)
      .order('is_active', { ascending: false })
      .order('expires_at', { ascending: true });

    if (couponErr) { setError('쿠폰 목록을 불러오지 못했습니다.'); setLoading(false); return; }

    const list: Coupon[] = couponData || [];

    // 각 쿠폰의 사용 완료 수 집계
    if (list.length > 0) {
      const ids = list.map(c => c.id);
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
      list.forEach(c => { c.used_count = usedMap[c.id] || 0; });
    }

    setCoupons(list);
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    loadData(session.user_id);
  }, [session]);

  /* ── 활성/비활성 토글 ── */
  const handleToggle = async (coupon: Coupon) => {
    setToggling(coupon.id);
    const sb = createClient();
    const { error: err } = await sb
      .from('coupons')
      .update({ is_active: !coupon.is_active })
      .eq('id', coupon.id);
    if (!err) {
      setCoupons(prev =>
        prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c),
      );
    }
    setToggling(null);
  };

  /* ── 쿠폰 삭제 ── */
  const handleDelete = async (couponId: string) => {
    if (!confirm('쿠폰을 삭제하시겠습니까?')) return;
    setDeleting(couponId);
    const sb = createClient();
    const { error: err } = await sb.from('coupons').delete().eq('id', couponId);
    if (!err) {
      setCoupons(prev => prev.filter(c => c.id !== couponId));
    }
    setDeleting(null);
  };

  /* ── 쿠폰 생성 ── */
  const handleSave = async () => {
    if (!storeId || !form.title.trim()) return;
    if (!form.discount_value || !form.total_quantity || !form.expires_at) {
      setSaveError('모든 필수 항목을 입력해주세요.');
      return;
    }
    setSaving(true);
    setSaveError('');
    const sb = createClient();
    const { error: err } = await sb.from('coupons').insert({
      store_id:       storeId,
      title:          form.title.trim(),
      description:    form.description.trim() || null,
      discount_type:  form.discount_type,
      discount_value: parseFloat(form.discount_value),
      total_quantity: parseInt(form.total_quantity, 10),
      issued_count:   0,
      is_active:      true,
      expires_at:     new Date(form.expires_at).toISOString(),
    });

    if (err) {
      setSaveError('저장 중 오류가 발생했습니다.');
    } else {
      setShowModal(false);
      setForm(EMPTY_FORM);
      setLoading(true);
      await loadData(session!.user_id);
    }
    setSaving(false);
  };

  if (!session) return null;

  /* ── 통계 요약 ── */
  const activeCnt  = coupons.filter(c => c.is_active).length;
  const totalIssue = coupons.reduce((s, c) => s + c.issued_count, 0);
  const totalUsed  = coupons.reduce((s, c) => s + (c.used_count || 0), 0);

  /* ── 로딩 스켈레톤 ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-border-main shrink-0">
          <div className="h-6 w-32 bg-fill-subtle rounded animate-pulse" />
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border-main rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-primary">쿠폰 관리</h1>
          <p className="text-xs text-muted mt-0.5">고객에게 제공할 쿠폰을 만들고 관리하세요.</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setSaveError(''); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#FF6F0F] text-white hover:bg-[#e56500] transition"
        >
          <Plus size={15} />
          쿠폰 만들기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* 통계 요약 */}
        {coupons.length > 0 && (
          <div className="flex gap-3 mb-5 flex-wrap">
            {[
              { label: '활성 쿠폰',  value: `${activeCnt}개` },
              { label: '총 발급',    value: `${totalIssue.toLocaleString()}장` },
              { label: '사용 완료',  value: `${totalUsed.toLocaleString()}장` },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-border-main rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xs text-muted">{stat.label}</span>
                <span className="text-sm font-bold text-primary">{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted">
            <Ticket size={40} className="text-muted/30" />
            <p className="text-sm">아직 쿠폰이 없어요</p>
            <button
              onClick={() => { setShowModal(true); setSaveError(''); setForm(EMPTY_FORM); }}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#FF6F0F] text-white hover:bg-[#e56500] transition"
            >
              <Plus size={14} />
              첫 쿠폰 만들기
            </button>
          </div>
        ) : (
          /* 쿠폰 카드 그리드 2열 */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            {coupons.map(coupon => {
              const expired = new Date(coupon.expires_at) < new Date();
              const dday    = dDay(coupon.expires_at);
              const progress = coupon.total_quantity > 0
                ? Math.min(coupon.issued_count / coupon.total_quantity, 1)
                : 0;

              return (
                <div
                  key={coupon.id}
                  className={`bg-card border rounded-xl p-5 flex flex-col gap-3 ${
                    coupon.is_active && !expired ? 'border-border-main' : 'border-border-subtle opacity-60'
                  }`}
                >
                  {/* 제목 & 할인 */}
                  <div className="flex items-start gap-2">
                    <Ticket size={16} className="text-[#FF6F0F] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary leading-tight truncate">{coupon.title}</p>
                      <p className="text-xs text-[#FF6F0F] font-semibold mt-0.5">
                        {fmtDiscount(coupon.discount_type, coupon.discount_value)} 할인
                      </p>
                    </div>
                  </div>

                  {/* 진행 바 */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted mb-1">
                      <span>발급 현황</span>
                      <span>{coupon.issued_count.toLocaleString()} / {coupon.total_quantity.toLocaleString()}장</span>
                    </div>
                    <div className="w-full h-1.5 bg-fill-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FF6F0F] rounded-full transition-all"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* 사용 수 & 만료일 */}
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>사용 {(coupon.used_count || 0).toLocaleString()}장</span>
                    <span className="text-border-main">·</span>
                    <span className={expired ? 'text-red-400 font-semibold' : ''}>
                      {expired ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-semibold">
                          만료됨
                        </span>
                      ) : (
                        dday
                      )}
                    </span>
                    {!expired && (
                      <span className="text-dim">{fmtDate(coupon.expires_at)}</span>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border-subtle">
                    {/* 활성 토글 */}
                    <button
                      onClick={() => handleToggle(coupon)}
                      disabled={toggling === coupon.id}
                      className="flex items-center gap-2 text-xs font-medium text-muted hover:text-primary transition"
                    >
                      {toggling === coupon.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <div
                          className={`relative w-8 h-4.5 rounded-full transition-colors ${
                            coupon.is_active ? 'bg-[#FF6F0F]' : 'bg-fill-subtle'
                          }`}
                          style={{ height: '18px', width: '32px' }}
                        >
                          <div
                            className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                              coupon.is_active ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </div>
                      )}
                      {coupon.is_active ? '활성' : '비활성'}
                    </button>

                    <span className="flex-1" />

                    {/* 삭제 버튼 — 비활성 쿠폰만 */}
                    {!coupon.is_active && (
                      <button
                        onClick={() => handleDelete(coupon.id)}
                        disabled={deleting === coupon.id}
                        className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-500/10"
                      >
                        {deleting === coupon.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 쿠폰 생성 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border-main rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-main shrink-0">
              <h2 className="text-base font-bold text-primary">새 쿠폰 만들기</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-muted hover:bg-fill-subtle hover:text-primary transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {saveError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  <AlertCircle size={13} className="shrink-0" />
                  {saveError}
                </div>
              )}

              {/* 쿠폰 제목 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-1.5">
                  쿠폰 제목 <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예) 봄맞이 10% 할인"
                  className="w-full px-3 py-2.5 text-sm bg-surface border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-1.5">
                  설명 <span className="text-dim font-normal">(선택)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="쿠폰에 대한 상세 설명을 입력하세요"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm bg-surface border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition resize-none"
                />
              </div>

              {/* 할인 종류 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-1.5">
                  할인 종류 <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-3">
                  {(['percent', 'amount'] as const).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="discount_type"
                        value={type}
                        checked={form.discount_type === type}
                        onChange={() => setForm(f => ({ ...f, discount_type: type }))}
                        className="accent-[#FF6F0F]"
                      />
                      <span className="text-sm text-secondary">{type === 'percent' ? '% 할인' : '금액 할인'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 할인 값 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-1.5">
                  할인 값 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.discount_value}
                    onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                    placeholder={form.discount_type === 'percent' ? '예) 10' : '예) 3000'}
                    min={0}
                    className="w-full px-3 py-2.5 pr-12 text-sm bg-surface border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                    {form.discount_type === 'percent' ? '%' : '원'}
                  </span>
                </div>
              </div>

              {/* 총 발급 수량 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-1.5">
                  총 발급 수량 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.total_quantity}
                    onChange={e => setForm(f => ({ ...f, total_quantity: e.target.value }))}
                    placeholder="예) 100"
                    min={1}
                    className="w-full px-3 py-2.5 pr-8 text-sm bg-surface border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">장</span>
                </div>
              </div>

              {/* 만료일 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-1.5">
                  만료일 <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 text-sm bg-surface border border-border-main rounded-xl outline-none focus:border-[#FF6F0F] text-primary transition"
                />
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="px-5 py-4 border-t border-border-main flex gap-3 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-fill-subtle text-secondary hover:bg-border-main transition"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#FF6F0F] text-white hover:bg-[#e56500] transition disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                {saving ? '저장 중...' : '쿠폰 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
