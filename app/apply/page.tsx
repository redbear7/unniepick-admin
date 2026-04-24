'use client';

/**
 * /apply — 점주 가게 등록 신청 (da24 스타일 단계별 위저드)
 *
 * Step 1 · 가게 이름
 * Step 2 · 카테고리
 * Step 3 · 가게 주소
 * Step 4 · 가게 전화번호 (선택)
 * Step 5 · 첫 번째 쿠폰 설정 (필수)
 * Step 6 · 사장님 정보
 * Done  · 완료 화면
 */

import { useState, useCallback } from 'react';
import Script from 'next/script';
import { ChevronLeft, Check, MapPin, Loader2, Tag, Percent, CircleDollarSign, Gift } from 'lucide-react';
import { openPostcode } from '@/lib/daum-postcode';

// ── Types ────────────────────────────────────────────────────────────────────
type CouponType = 'free_item' | 'percent' | 'amount';

interface FormData {
  // Step 1
  storeName: string;
  // Step 2
  category: string;
  // Step 3
  address: string;
  addressDetail: string;
  // Step 4
  storePhone: string;
  // Step 5
  couponType: CouponType;
  couponTitle: string;
  couponValue: string;
  freeItemName: string;
  couponExpiry: string;
  couponQty: number;
  // Step 6
  ownerName: string;
  ownerPhone: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'cafe',    emoji: '☕', label: '카페' },
  { key: 'food',    emoji: '🍽️', label: '음식점' },
  { key: 'beauty',  emoji: '✂️', label: '미용실' },
  { key: 'nail',    emoji: '💅', label: '네일샵' },
  { key: 'fashion', emoji: '👗', label: '의류' },
  { key: 'fitness', emoji: '💪', label: '헬스/운동' },
  { key: 'mart',    emoji: '🛒', label: '마트/편의' },
  { key: 'etc',     emoji: '🏪', label: '기타' },
];

const COUPON_TYPES: { key: CouponType; icon: React.ReactNode; label: string; desc: string }[] = [
  { key: 'free_item', icon: <Gift  size={18} />, label: '무료 제공', desc: '아이템 1개 무료' },
  { key: 'percent',   icon: <Percent size={18} />, label: '% 할인',  desc: '비율로 할인' },
  { key: 'amount',    icon: <CircleDollarSign size={18} />, label: '원 할인', desc: '금액 할인' },
];

const TOTAL_STEPS = 6;

function defaultExpiry() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}
function minExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const [step,       setStep]       = useState(1);
  const [form,       setForm]       = useState<FormData>({
    storeName: '', category: '', address: '', addressDetail: '',
    storePhone: '', couponType: 'free_item', couponTitle: '',
    couponValue: '', freeItemName: '', couponExpiry: defaultExpiry(),
    couponQty: 100, ownerName: '', ownerPhone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(false);

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────
  const canNext = (): boolean => {
    switch (step) {
      case 1: return form.storeName.trim().length > 0;
      case 2: return form.category.length > 0;
      case 3: return form.address.length > 0;
      case 4: return true; // 선택사항
      case 5: {
        if (!form.couponTitle.trim()) return false;
        if (!form.couponExpiry)       return false;
        if (form.couponType === 'free_item') return form.freeItemName.trim().length > 0;
        return form.couponValue.trim().length > 0 && Number(form.couponValue) > 0;
      }
      case 6: return form.ownerName.trim().length > 0 && form.ownerPhone.replace(/\D/g, '').length >= 10;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      handleSubmit();
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const couponDraft = {
        discount_type:  form.couponType,
        title:          form.couponTitle.trim(),
        discount_value: form.couponType !== 'free_item' ? Number(form.couponValue) : 0,
        free_item_name: form.couponType === 'free_item' ? form.freeItemName.trim() : null,
        expires_at:     form.couponExpiry ? new Date(form.couponExpiry + 'T23:59:59+09:00').toISOString() : null,
        total_quantity: form.couponQty,
      };

      const res = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name:     form.storeName.trim(),
          category:       form.category,
          address:        form.address,
          address_detail: form.addressDetail.trim() || null,
          phone:          form.storePhone.trim() || null,
          owner_name:     form.ownerName.trim(),
          owner_phone:    form.ownerPhone.trim(),
          coupon_draft:   couponDraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출에 실패했습니다');
      setDone(true);
    } catch (e: unknown) {
      setError((e as Error).message ?? '오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Done Screen ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#FF6F0F]/10 flex items-center justify-center mb-6">
          <Check size={36} className="text-[#FF6F0F]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">신청 완료! 🎉</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          <strong className="text-gray-800">{form.storeName}</strong> 등록 신청이 접수됐어요.<br />
          영업일 1~2일 내로 사장님 연락처로 연락드릴게요.
        </p>
        <div className="bg-orange-50 border border-orange-100 rounded-2xl px-6 py-4 max-w-xs text-left">
          <p className="text-xs font-semibold text-[#FF6F0F] mb-1">📌 등록 후 자동으로 진행돼요</p>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
            <li>팔로워에게 첫 번째 쿠폰 자동 발행</li>
            <li>언니픽 앱에 가게 노출 시작</li>
            <li>사장님 전용 관리 페이지 이용 가능</li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Step Meta ───────────────────────────────────────────────────────────────
  const stepMeta: Record<number, { title: string; subtitle: string }> = {
    1: { title: '가게 이름이 뭐예요?',            subtitle: '언니픽에 표시될 가게 이름이에요' },
    2: { title: '어떤 가게인가요?',               subtitle: '가장 잘 맞는 카테고리를 선택해주세요' },
    3: { title: '가게는 어디에 있나요?',           subtitle: '주소를 검색하거나 직접 입력해주세요' },
    4: { title: '가게 전화번호가 있나요?',         subtitle: '입력하면 고객이 바로 전화할 수 있어요 (선택)' },
    5: { title: '팔로워에게 줄 쿠폰을 만들어요 🎁', subtitle: '첫 번째 쿠폰은 필수예요 — 나중에 수정 가능해요' },
    6: { title: '사장님 정보를 입력해주세요',       subtitle: '검토 결과를 이 번호로 알려드려요' },
  };

  const meta = stepMeta[step];
  const isLast = step === TOTAL_STEPS;

  return (
    <>
      {/* 카카오 우편번호 서비스 */}
      <Script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />

      <div className="min-h-[calc(100vh-120px)] flex flex-col">

        {/* ── 진행 바 ───────────────────────────────────────────── */}
        <div className="px-5 pt-6 pb-2 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2 mb-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                  i < step ? 'bg-[#FF6F0F]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 text-right">{step} / {TOTAL_STEPS}</p>
        </div>

        {/* ── 스텝 콘텐츠 ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col px-5 max-w-lg mx-auto w-full pt-8 pb-4">

          {/* 제목 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{meta.title}</h1>
            <p className="text-sm text-gray-400 mt-1.5">{meta.subtitle}</p>
          </div>

          {/* ── STEP 1: 가게 이름 ─────────────────────────────────── */}
          {step === 1 && (
            <input
              autoFocus
              value={form.storeName}
              onChange={e => set('storeName', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canNext() && handleNext()}
              placeholder="예: 언니네 카페"
              className="w-full border-0 border-b-2 border-gray-200 focus:border-[#FF6F0F] outline-none text-2xl font-semibold text-gray-900 placeholder-gray-300 pb-3 bg-transparent transition-colors"
            />
          )}

          {/* ── STEP 2: 카테고리 ──────────────────────────────────── */}
          {step === 2 && (
            <div className="grid grid-cols-4 gap-3">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => { set('category', c.key); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    form.category === c.key
                      ? 'border-[#FF6F0F] bg-orange-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className={`text-xs font-semibold ${form.category === c.key ? 'text-[#FF6F0F]' : 'text-gray-600'}`}>
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 3: 주소 ──────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* 주소 검색 버튼 */}
              <button
                onClick={() => openPostcode(addr => set('address', addr))}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 text-left transition-all ${
                  form.address
                    ? 'border-[#FF6F0F] bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <MapPin size={20} className={form.address ? 'text-[#FF6F0F]' : 'text-gray-400'} />
                <span className={`text-sm font-medium ${form.address ? 'text-gray-900' : 'text-gray-400'}`}>
                  {form.address || '주소 검색하기'}
                </span>
              </button>

              {/* 상세주소 */}
              {form.address && (
                <input
                  autoFocus
                  value={form.addressDetail}
                  onChange={e => set('addressDetail', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canNext() && handleNext()}
                  placeholder="상세주소 입력 (예: 2층 203호)"
                  className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-4 py-4 text-sm text-gray-900 placeholder-gray-400 transition-colors"
                />
              )}
            </div>
          )}

          {/* ── STEP 4: 가게 전화번호 (선택) ─────────────────────── */}
          {step === 4 && (
            <input
              autoFocus
              type="tel"
              inputMode="tel"
              value={form.storePhone}
              onChange={e => set('storePhone', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              placeholder="예: 055-123-4567"
              className="w-full border-0 border-b-2 border-gray-200 focus:border-[#FF6F0F] outline-none text-2xl font-semibold text-gray-900 placeholder-gray-300 pb-3 bg-transparent transition-colors"
            />
          )}

          {/* ── STEP 5: 쿠폰 설정 ─────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5">
              {/* 쿠폰 유형 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">쿠폰 유형</p>
                <div className="grid grid-cols-3 gap-2">
                  {COUPON_TYPES.map(ct => (
                    <button
                      key={ct.key}
                      onClick={() => set('couponType', ct.key)}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-2xl border-2 transition-all ${
                        form.couponType === ct.key
                          ? 'border-[#FF6F0F] bg-orange-50 text-[#FF6F0F]'
                          : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      {ct.icon}
                      <span className="text-xs font-semibold">{ct.label}</span>
                      <span className="text-[10px] text-gray-400">{ct.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 쿠폰 이름 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">쿠폰 이름 *</p>
                <input
                  value={form.couponTitle}
                  onChange={e => set('couponTitle', e.target.value)}
                  placeholder={
                    form.couponType === 'free_item' ? '예: 팔로워 전용 아메리카노 1잔 무료' :
                    form.couponType === 'percent'   ? '예: 팔로워 전용 10% 할인' :
                    '예: 팔로워 전용 2,000원 할인'
                  }
                  className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 transition-colors"
                />
              </div>

              {/* 할인 내용 */}
              <div>
                {form.couponType === 'free_item' && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mb-2">무료 제공 아이템 *</p>
                    <input
                      value={form.freeItemName}
                      onChange={e => set('freeItemName', e.target.value)}
                      placeholder="예: 아메리카노 (Hot/Ice)"
                      className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 transition-colors"
                    />
                  </>
                )}
                {form.couponType === 'percent' && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mb-2">할인율 (%) *</p>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1} max={100}
                        value={form.couponValue}
                        onChange={e => set('couponValue', e.target.value)}
                        placeholder="10"
                        className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 transition-colors pr-10"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
                    </div>
                  </>
                )}
                {form.couponType === 'amount' && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 mb-2">할인 금액 (원) *</p>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={form.couponValue}
                        onChange={e => set('couponValue', e.target.value)}
                        placeholder="2000"
                        className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 transition-colors pr-10"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">원</span>
                    </div>
                  </>
                )}
              </div>

              {/* 유효기간 + 발급 수량 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">쿠폰 유효기간 *</p>
                  <input
                    type="date"
                    min={minExpiry()}
                    value={form.couponExpiry}
                    onChange={e => set('couponExpiry', e.target.value)}
                    className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-3 py-3.5 text-sm text-gray-900 transition-colors"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">발급 수량</p>
                  <div className="flex items-center border-2 border-gray-200 focus-within:border-[#FF6F0F] rounded-2xl overflow-hidden transition-colors">
                    <button
                      type="button"
                      onClick={() => set('couponQty', Math.max(10, form.couponQty - 10))}
                      className="px-3 py-3.5 text-gray-500 hover:bg-gray-50 font-bold text-lg transition-colors"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-sm font-semibold text-gray-900">
                      {form.couponQty}장
                    </span>
                    <button
                      type="button"
                      onClick={() => set('couponQty', Math.min(9999, form.couponQty + 10))}
                      className="px-3 py-3.5 text-gray-500 hover:bg-gray-50 font-bold text-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* 쿠폰 미리보기 */}
              {form.couponTitle && (
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-[#FF6F0F] mb-1.5">미리보기</p>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🎟️</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{form.couponTitle}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {form.couponType === 'free_item' && form.freeItemName && `🎁 ${form.freeItemName} 무료 제공`}
                        {form.couponType === 'percent'   && form.couponValue   && `${form.couponValue}% 할인`}
                        {form.couponType === 'amount'    && form.couponValue   && `${Number(form.couponValue).toLocaleString()}원 할인`}
                      </p>
                      {form.couponExpiry && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          ~{new Date(form.couponExpiry).toLocaleDateString('ko-KR')} · {form.couponQty}장
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 6: 사장님 정보 ───────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">사장님 이름 *</p>
                <input
                  autoFocus
                  value={form.ownerName}
                  onChange={e => set('ownerName', e.target.value)}
                  placeholder="홍길동"
                  className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-4 py-4 text-base font-semibold text-gray-900 placeholder-gray-400 transition-colors"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">연락처 (휴대폰) *</p>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.ownerPhone}
                  onChange={e => set('ownerPhone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-4 py-4 text-base font-semibold text-gray-900 placeholder-gray-400 transition-colors"
                />
              </div>
              {/* 신청 요약 */}
              <div className="bg-gray-50 rounded-2xl p-4 mt-2">
                <p className="text-xs font-semibold text-gray-400 mb-3">신청 내용 확인</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="text-gray-400 w-14 shrink-0">가게명</span>
                    <span className="font-semibold text-gray-900">{form.storeName}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gray-400 w-14 shrink-0">카테고리</span>
                    <span className="font-semibold text-gray-900">
                      {CATEGORIES.find(c => c.key === form.category)?.emoji}{' '}
                      {CATEGORIES.find(c => c.key === form.category)?.label}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gray-400 w-14 shrink-0">주소</span>
                    <span className="font-semibold text-gray-900">{form.address}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gray-400 w-14 shrink-0">쿠폰</span>
                    <span className="font-semibold text-[#FF6F0F]">🎟️ {form.couponTitle}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── 에러 ────────────────────────────────────────────── */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* ── 하단 내비 ──────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="w-12 h-14 flex items-center justify-center rounded-2xl border-2 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-all shrink-0"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canNext() || submitting}
              className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all ${
                canNext() && !submitting
                  ? 'bg-[#FF6F0F] text-white shadow-lg shadow-orange-200 hover:bg-[#e66000]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <><Loader2 size={18} className="animate-spin" /> 제출 중...</>
              ) : step === 4 && !form.storePhone ? (
                '건너뛰기'
              ) : isLast ? (
                '신청하기 →'
              ) : (
                '다음 →'
              )}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
