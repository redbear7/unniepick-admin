'use client';

/**
 * /apply — 점주 가게 등록 신청 (da24 스타일 단계별 위저드)
 *
 * Step 0 · 카카오에서 가게 검색 (선택) ← 신규
 *           └─ 찾았을 때 → 자동입력 → Step 5 (쿠폰)로 점프
 *           └─ 없으면 "직접 입력하기" → Step 1부터 수동 진행
 * Step 1 · 가게 이름
 * Step 2 · 카테고리
 * Step 3 · 가게 주소
 * Step 4 · 가게 전화번호 (선택)
 * Step 5 · 첫 번째 쿠폰 설정 (필수)
 * Step 6 · 사장님 정보
 * Done  · 완료 화면
 */

import { useState, useCallback, useRef } from 'react';
import Script from 'next/script';
import { ChevronLeft, Check, MapPin, Loader2, Percent, CircleDollarSign, Gift, Search, X } from 'lucide-react';
import { openPostcode } from '@/lib/daum-postcode';

// ── Types ────────────────────────────────────────────────────────────────────
type CouponType = 'free_item' | 'percent' | 'amount';

interface FormData {
  storeName: string;
  category: string;
  address: string;
  addressDetail: string;
  storePhone: string;
  latitude: number | null;
  longitude: number | null;
  kakaoPlaceUrl: string | null;
  couponType: CouponType;
  couponTitle: string;
  couponValue: string;
  freeItemName: string;
  couponExpiry: string;
  couponQty: number;
  ownerName: string;
  ownerPhone: string;
}

interface KakaoPlace {
  kakao_id: string;
  place_name: string;
  address: string;
  road_address: string | null;
  phone: string | null;
  category: string;
  category_raw: string;
  latitude: number | null;
  longitude: number | null;
  place_url: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'cafe',    emoji: '☕',  label: '카페' },
  { key: 'food',    emoji: '🍽️', label: '음식점' },
  { key: 'beauty',  emoji: '✂️',  label: '미용실' },
  { key: 'nail',    emoji: '💅',  label: '네일샵' },
  { key: 'fashion', emoji: '👗',  label: '의류' },
  { key: 'fitness', emoji: '💪',  label: '헬스/운동' },
  { key: 'mart',    emoji: '🛒',  label: '마트/편의' },
  { key: 'etc',     emoji: '🏪',  label: '기타' },
];

// 카카오 카테고리 → 언니픽 category key
const KAKAO_CAT_KEY: Record<string, string> = {
  '카페':     'cafe',
  '베이커리':  'cafe',
  '제과':      'cafe',
  '한식':      'food',
  '중식':      'food',
  '일식':      'food',
  '양식':      'food',
  '분식':      'food',
  '술집':      'food',
  '패스트푸드': 'food',
  '미용실':    'beauty',
  '헤어':      'beauty',
  '네일':      'nail',
  '의류':      'fashion',
  '헬스':      'fitness',
  '마트':      'mart',
  '편의점':    'mart',
};

function kakaoRawToCatKey(raw: string): string {
  const parts = raw.split('>').map(s => s.trim()).reverse();
  for (const part of parts) {
    for (const [k, v] of Object.entries(KAKAO_CAT_KEY)) {
      if (part.includes(k)) return v;
    }
  }
  return 'etc';
}

const COUPON_TYPES: { key: CouponType; icon: React.ReactNode; label: string; desc: string }[] = [
  { key: 'free_item', icon: <Gift             size={18} />, label: '무료 제공', desc: '아이템 1개 무료' },
  { key: 'percent',   icon: <Percent          size={18} />, label: '% 할인',   desc: '비율로 할인' },
  { key: 'amount',    icon: <CircleDollarSign size={18} />, label: '원 할인',   desc: '금액 할인' },
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
  // step 0 = 카카오 검색, 1~6 = 수동입력, 7 = 완료
  const [step,       setStep]       = useState(0);
  const [form,       setForm]       = useState<FormData>({
    storeName: '', category: '', address: '', addressDetail: '',
    storePhone: '', latitude: null, longitude: null, kakaoPlaceUrl: null,
    couponType: 'free_item', couponTitle: '', couponValue: '',
    freeItemName: '', couponExpiry: defaultExpiry(), couponQty: 100,
    ownerName: '', ownerPhone: '',
  });

  // ── Step 0: 카카오 검색 상태 ──────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<KakaoPlace[] | null>(null);
  const [searching,     setSearching]     = useState(false);
  const [searchError,   setSearchError]   = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── 공통 ─────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(false);

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  // ── 카카오 검색 ─────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchResults(null);
    try {
      // 현재 위치 (선택적) — 실패해도 검색 진행
      let coords = '';
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
        );
        coords = `&x=${pos.coords.longitude}&y=${pos.coords.latitude}`;
      } catch { /* 위치 없이 검색 */ }

      const res = await fetch(`/api/kakao-place?q=${encodeURIComponent(q)}${coords}&size=5`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '검색 실패');

      setSearchResults(data.places ?? []);
      if ((data.places ?? []).length === 0) setSearchError('검색 결과가 없어요. 가게 이름을 다시 확인해주세요.');
    } catch (e: unknown) {
      setSearchError((e as Error).message ?? '검색 중 오류가 발생했어요');
    } finally {
      setSearching(false);
    }
  };

  // 카카오 결과 선택 → 자동입력 → Step 5 (쿠폰)으로 점프
  const handleSelectPlace = (place: KakaoPlace) => {
    setForm(prev => ({
      ...prev,
      storeName:    place.place_name,
      category:     kakaoRawToCatKey(place.category_raw),
      address:      place.road_address ?? place.address,
      addressDetail: '',
      storePhone:   place.phone ?? '',
      latitude:     place.latitude,
      longitude:    place.longitude,
      kakaoPlaceUrl: place.place_url,
    }));
    setStep(5); // 쿠폰 단계로 바로 점프
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const canNext = (): boolean => {
    switch (step) {
      case 1: return form.storeName.trim().length > 0;
      case 2: return form.category.length > 0;
      case 3: return form.address.length > 0;
      case 4: return true;
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
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else handleSubmit();
  };

  // ── Submit ───────────────────────────────────────────────────────────────
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
          latitude:       form.latitude,
          longitude:      form.longitude,
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

  // ── Done ─────────────────────────────────────────────────────────────────
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

  // ── Step 0: 카카오 검색 ──────────────────────────────────────────────────
  if (step === 0) {
    return (
      <>
        <Script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />
        <div className="min-h-[calc(100vh-120px)] flex flex-col px-5 max-w-lg mx-auto w-full pt-10 pb-6">

          {/* 헤더 */}
          <div className="mb-8">
            <p className="text-3xl mb-3">👋</p>
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">
              언니픽에<br />가게를 등록해보세요
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              카카오에 등록된 가게라면 정보를 바로 불러올 수 있어요
            </p>
          </div>

          {/* 카카오 검색 */}
          <div className="mb-4">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center border-2 border-gray-200 focus-within:border-[#FEE500] rounded-2xl overflow-hidden transition-colors bg-white">
                <span className="pl-4 text-[#FEE500]">
                  {/* 카카오 K 아이콘 */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#3A1D1D">
                    <path d="M12 3C6.477 3 2 6.477 2 10.6c0 2.7 1.707 5.073 4.29 6.424l-.895 3.312a.4.4 0 00.59.44L10.04 18.3a11.3 11.3 0 001.96.17c5.523 0 10-3.477 10-7.87C22 6.477 17.523 3 12 3z"/>
                  </svg>
                </span>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="가게 이름 또는 주소로 검색"
                  className="flex-1 px-3 py-4 text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults(null); setSearchError(''); }} className="pr-3 text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
                className="shrink-0 w-14 flex items-center justify-center rounded-2xl bg-[#FEE500] hover:bg-[#f0d800] disabled:opacity-40 transition-all"
              >
                {searching
                  ? <Loader2 size={18} className="animate-spin text-[#3A1D1D]" />
                  : <Search size={18} className="text-[#3A1D1D]" />
                }
              </button>
            </div>

            {searchError && (
              <p className="mt-2 text-xs text-red-500 px-1">{searchError}</p>
            )}
          </div>

          {/* 검색 결과 */}
          {searchResults !== null && (
            <div className="flex-1 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {searchResults.map(place => (
                    <button
                      key={place.kakao_id}
                      onClick={() => handleSelectPlace(place)}
                      className="w-full flex items-start gap-3 p-4 bg-white border-2 border-gray-100 hover:border-[#FEE500] hover:bg-yellow-50 rounded-2xl text-left transition-all group"
                    >
                      <span className="w-9 h-9 rounded-xl bg-yellow-50 group-hover:bg-yellow-100 flex items-center justify-center shrink-0 text-base transition-colors">
                        {CATEGORIES.find(c => c.key === kakaoRawToCatKey(place.category_raw))?.emoji ?? '🏪'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{place.place_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{place.address}</p>
                        {place.phone && (
                          <p className="text-xs text-gray-400 mt-0.5">{place.phone}</p>
                        )}
                        <p className="text-[10px] text-gray-300 mt-1">{place.category_raw}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[#FF6F0F] opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        선택 →
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* 하단 액션 */}
          <div className="mt-auto pt-4 space-y-3">
            {/* 카카오에 없는 가게 → 수동 입력 */}
            <button
              onClick={() => setStep(1)}
              className="w-full py-4 rounded-2xl border-2 border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800 font-semibold text-sm transition-all"
            >
              카카오에 없는 가게예요 → 직접 입력하기
            </button>
          </div>

        </div>
      </>
    );
  }

  // ── Step 1~6: 수동 입력 위저드 ─────────────────────────────────────────────
  const stepMeta: Record<number, { title: string; subtitle: string }> = {
    1: { title: '가게 이름이 뭐예요?',             subtitle: '언니픽에 표시될 가게 이름이에요' },
    2: { title: '어떤 가게인가요?',                subtitle: '가장 잘 맞는 카테고리를 선택해주세요' },
    3: { title: '가게는 어디에 있나요?',            subtitle: '주소를 검색하거나 직접 입력해주세요' },
    4: { title: '가게 전화번호가 있나요?',          subtitle: '입력하면 고객이 바로 전화할 수 있어요 (선택)' },
    5: { title: '팔로워에게 줄 쿠폰을 만들어요 🎁', subtitle: '첫 번째 쿠폰은 필수예요 — 나중에 수정 가능해요' },
    6: { title: '사장님 정보를 입력해주세요',        subtitle: '검토 결과를 이 번호로 알려드려요' },
  };

  const meta  = stepMeta[step];
  const isLast = step === TOTAL_STEPS;

  // 카카오 자동입력으로 왔을 때 (step >= 5, 가게정보 이미 채워짐) 진행바 표시용
  // steps 1~4가 채워진 것으로 간주
  const progressFilled = step;

  return (
    <>
      <Script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />
      <div className="min-h-[calc(100vh-120px)] flex flex-col">

        {/* ── 진행 바 ─────────────────────────────────────────── */}
        <div className="px-5 pt-6 pb-2 max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2 mb-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                  i < progressFilled ? 'bg-[#FF6F0F]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => step === 1 ? setStep(0) : setStep(s => s - 1)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft size={13} /> 이전
            </button>
            <p className="text-xs text-gray-400">{step} / {TOTAL_STEPS}</p>
          </div>
        </div>

        {/* ── 스텝 콘텐츠 ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col px-5 max-w-lg mx-auto w-full pt-8 pb-4">

          {/* 카카오 자동입력 뱃지 (step 5 진입 시 표시) */}
          {step === 5 && form.storeName && form.kakaoPlaceUrl && (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl w-fit">
              <span className="text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#3A1D1D" className="inline mr-1">
                  <path d="M12 3C6.477 3 2 6.477 2 10.6c0 2.7 1.707 5.073 4.29 6.424l-.895 3.312a.4.4 0 00.59.44L10.04 18.3a11.3 11.3 0 001.96.17c5.523 0 10-3.477 10-7.87C22 6.477 17.523 3 12 3z"/>
                </svg>
              </span>
              <span className="text-xs font-semibold text-yellow-800">
                {form.storeName} — 카카오 정보 자동입력 완료
              </span>
              <Check size={12} className="text-green-600" />
            </div>
          )}

          {/* 제목 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{meta.title}</h1>
            <p className="text-sm text-gray-400 mt-1.5">{meta.subtitle}</p>
          </div>

          {/* ── STEP 1: 가게 이름 ─────────────────────────────── */}
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

          {/* ── STEP 2: 카테고리 ──────────────────────────────── */}
          {step === 2 && (
            <div className="grid grid-cols-4 gap-3">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => set('category', c.key)}
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

          {/* ── STEP 3: 주소 ────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <button
                onClick={() => openPostcode(addr => set('address', addr))}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 text-left transition-all ${
                  form.address ? 'border-[#FF6F0F] bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <MapPin size={20} className={form.address ? 'text-[#FF6F0F]' : 'text-gray-400'} />
                <span className={`text-sm font-medium ${form.address ? 'text-gray-900' : 'text-gray-400'}`}>
                  {form.address || '주소 검색하기'}
                </span>
              </button>
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

          {/* ── STEP 4: 전화번호 (선택) ───────────────────────── */}
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

          {/* ── STEP 5: 쿠폰 설정 ─────────────────────────────── */}
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
                        type="number" inputMode="numeric" min={1} max={100}
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
                        type="number" inputMode="numeric" min={1}
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
                    type="date" min={minExpiry()}
                    value={form.couponExpiry}
                    onChange={e => set('couponExpiry', e.target.value)}
                    className="w-full border-2 border-gray-200 focus:border-[#FF6F0F] outline-none rounded-2xl px-3 py-3.5 text-sm text-gray-900 transition-colors"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">발급 수량</p>
                  <div className="flex items-center border-2 border-gray-200 focus-within:border-[#FF6F0F] rounded-2xl overflow-hidden transition-colors">
                    <button type="button" onClick={() => set('couponQty', Math.max(10, form.couponQty - 10))}
                      className="px-3 py-3.5 text-gray-500 hover:bg-gray-50 font-bold text-lg transition-colors">−</button>
                    <span className="flex-1 text-center text-sm font-semibold text-gray-900">{form.couponQty}장</span>
                    <button type="button" onClick={() => set('couponQty', Math.min(9999, form.couponQty + 10))}
                      className="px-3 py-3.5 text-gray-500 hover:bg-gray-50 font-bold text-lg transition-colors">+</button>
                  </div>
                </div>
              </div>

              {/* 미리보기 */}
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

          {/* ── STEP 6: 사장님 정보 ──────────────────────────────── */}
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
                  type="tel" inputMode="tel"
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

          {/* 에러 */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* ── 하단 내비 ────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 max-w-lg mx-auto w-full">
          <button
            onClick={handleNext}
            disabled={!canNext() || submitting}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all ${
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
    </>
  );
}
