'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Delete, Store, User, Ticket, CheckCircle2, Zap, FileText, Navigation, Search, X, Sparkles } from 'lucide-react';

const SESSION_HOURS = 8;
const PIN_LENGTH = 4;

type SearchPlace = {
  place_name: string;
  address: string;
  road_address: string | null;
  phone: string | null;
  category_raw: string;
  latitude: number | null;
  longitude: number | null;
};

type CouponSuggestion = {
  discount_type: 'free_item' | 'percent' | 'amount';
  title: string;
  discount_value: number;
  free_item_name: string | null;
  reason: string;
  best_time?: string | null;
  target?: string | null;
  expected_effect?: string | null;
};

const CATEGORIES = [
  { key: 'cafe', emoji: '☕', label: '카페' },
  { key: 'food', emoji: '🍽️', label: '음식점' },
  { key: 'beauty', emoji: '✂️', label: '미용실' },
  { key: 'nail', emoji: '💅', label: '네일샵' },
  { key: 'fashion', emoji: '👗', label: '의류' },
  { key: 'fitness', emoji: '💪', label: '운동' },
  { key: 'mart', emoji: '🛒', label: '마트' },
  { key: 'etc', emoji: '🏪', label: '기타' },
];

const CATEGORY_MAP: Record<string, string> = {
  '카페': 'cafe', '베이커리': 'cafe', '제과': 'cafe',
  '한식': 'food', '중식': 'food', '일식': 'food', '양식': 'food', '분식': 'food', '술집': 'food', '패스트푸드': 'food',
  '미용실': 'beauty', '헤어': 'beauty',
  '네일': 'nail', '의류': 'fashion',
  '헬스': 'fitness', '운동': 'fitness', '마트': 'mart', '편의점': 'mart',
};

function rawToCategory(raw: string) {
  const parts = raw.split('>').map(s => s.trim()).reverse();
  for (const part of parts) {
    for (const [keyword, key] of Object.entries(CATEGORY_MAP)) {
      if (part.includes(keyword)) return key;
    }
  }
  return 'etc';
}

export default function OwnerLoginPage() {
  const router = useRouter();

  const [step, setStep]   = useState<'phone' | 'pin'>('phone');
  const [mode, setMode]   = useState<'login' | 'join'>('login');
  const [mid, setMid]     = useState('');  // 중간 4자리
  const [last, setLast]   = useState(''); // 끝 4자리
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinDone, setJoinDone] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [hasAgency, setHasAgency] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('');
  const [benefit, setBenefit] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeLatLng, setStoreLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [businessNumber, setBusinessNumber] = useState('');
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchPlace[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [couponSuggestions, setCouponSuggestions] = useState<CouponSuggestion[] | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<CouponSuggestion | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const midRef  = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('owner_session');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.exp > Date.now()) { router.replace('/owner/dashboard'); return; }
      }
    } catch {}
    midRef.current?.focus();
  }, [router]);

  const fullPhone = `010${mid}${last}`;

  // ── 전화번호 확인 ──
  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mid.length !== 4 || last.length !== 4) { setError('전화번호를 입력해주세요.'); return; }
    setError('');
    setStep('pin');
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mid.length !== 4 || last.length !== 4) { setError('휴대폰 번호를 끝까지 입력해주세요.'); return; }
    if (!ownerName.trim()) { setError('사장님 성함을 입력해주세요.'); return; }
    if (hasAgency && !agencyName.trim()) { setError('광고대행사명을 입력해주세요.'); return; }
    if (!storeName.trim()) { setError('가게 이름을 입력해주세요.'); return; }
    if (!category) { setError('카테고리를 선택해주세요.'); return; }
    if (!benefit.trim()) { setError('첫 혜택을 한 줄로 입력해주세요.'); return; }
    const cleanBusinessNumber = businessNumber.replace(/\D/g, '');
    if (!licenseFile && cleanBusinessNumber.length < 10) {
      setError('사업자등록증 사진 또는 10자리 사업자번호 중 하나를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let upload: { path?: string; file_name?: string } = {};
      if (licenseFile) {
        const fd = new FormData();
        fd.append('file', licenseFile);
        fd.append('phone', fullPhone);
        const uploadRes = await fetch('/api/owner/license-upload', {
          method: 'POST',
          body: fd,
        });
        upload = await uploadRes.json();
        if (!uploadRes.ok) throw new Error((upload as { error?: string }).error);
      }

      const res = await fetch('/api/owner/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: ownerName.trim(),
          owner_phone: fullPhone,
          has_agency: hasAgency,
          agency_name: hasAgency ? agencyName.trim() : undefined,
          store_name: storeName.trim(),
          category,
          benefit: benefit.trim(),
          coupon_suggestion: selectedSuggestion,
          address: address.trim() || undefined,
          address_detail: addressDetail.trim() || undefined,
          phone: storePhone.trim() || undefined,
          latitude: storeLatLng?.lat ?? undefined,
          longitude: storeLatLng?.lng ?? undefined,
          business_license_path: upload.path,
          business_license_file_name: upload.file_name,
          business_registration_number: cleanBusinessNumber || undefined,
          ...(gps ? {
            gps_latitude: gps.lat,
            gps_longitude: gps.lng,
            gps_accuracy_m: gps.accuracy,
          } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJoinDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchResults(null);
    try {
      const res = await fetch(`/api/naver-place?q=${encodeURIComponent(q)}&size=5`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '검색 실패');
      const places = data.places ?? [];
      setSearchResults(places);
      if (places.length === 0) setSearchError('검색 결과가 없어요. 직접 입력해주세요.');
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = (place: SearchPlace) => {
    setStoreName(place.place_name);
    setCategory(rawToCategory(place.category_raw));
    setAddress(place.road_address ?? place.address);
    setStorePhone(place.phone ?? '');
    setStoreLatLng(
      place.latitude !== null && place.longitude !== null
        ? { lat: place.latitude, lng: place.longitude }
        : null,
    );
    setSearchQuery(place.place_name);
    setSearchResults(null);
    setSearchError('');
    setError('');
  };

  const fetchCouponSuggestions = async () => {
    if (!storeName.trim()) {
      setError('가게 이름을 먼저 입력해주세요.');
      return;
    }
    setSuggestLoading(true);
    setError('');
    try {
      const res = await fetch('/api/applications/coupon-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName.trim(),
          category,
          address,
          first_benefit: benefit,
          mode: 'quick',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '추천 실패');
      setCouponSuggestions(data.suggestions ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggestLoading(false);
    }
  };

  const verifyGps = () => {
    if (!navigator.geolocation) {
      setError('이 브라우저에서는 위치 인증을 사용할 수 없습니다.');
      return;
    }
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGps({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
        setGpsLoading(false);
      },
      () => {
        setError('GPS 없이도 신청할 수 있어요. 가능하면 가게 안에서 다시 시도해주세요.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  async function verifyPin(p: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/owner/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, pin: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('owner_session', JSON.stringify({
        owner_pin_id: data.owner_pin_id,
        user_id:      data.user_id,
        name:         data.name,
        phone:        data.phone,
        created_at:   data.created_at,
        exp:          Date.now() + SESSION_HOURS * 60 * 60 * 1000,
      }));
      router.push('/owner/dashboard');
    } catch (e) {
      setError((e as Error).message);
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  // ── PIN 패드 ──
  const appendPin = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH) verifyPin(next);
  };

  const deletePin = () => setPin(p => p.slice(0, -1));

  // ── 키보드 입력 ──
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (step !== 'pin' || loading) return;
    if (/^\d$/.test(e.key)) {
      appendPin(e.key);
    } else if (e.key === 'Backspace') {
      deletePin();
    }
  }, [step, loading, pin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const displayPhone = `010-${mid || '____'}-${last || '____'}`;
  const phoneInput = (
    <div>
      <label className="block text-xs text-white/50 mb-2">휴대폰 번호</label>
      <div className="flex items-center gap-2">
        <div className="w-16 h-12 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-white font-bold text-base select-none shrink-0">
          010
        </div>
        <span className="text-white/30 text-lg">-</span>
        <input
          ref={midRef}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={mid}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            setMid(v);
            setError('');
            if (v.length === 4) lastRef.current?.focus();
          }}
          placeholder="0000"
          className="flex-1 h-12 bg-white/5 border border-white/10 rounded-xl px-3 text-white text-base text-center tracking-widest placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
        />
        <span className="text-white/30 text-lg">-</span>
        <input
          ref={lastRef}
          type="tel"
          inputMode="numeric"
          maxLength={4}
          value={last}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            setLast(v);
            setError('');
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && last === '') midRef.current?.focus();
          }}
          placeholder="0000"
          className="flex-1 h-12 bg-white/5 border border-white/10 rounded-xl px-3 text-white text-base text-center tracking-widest placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
        />
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6F0F] flex items-center justify-center text-2xl mb-3">🍖</div>
          <h1 className="text-xl font-bold text-white">언니픽 사장님 전용</h1>
          <p className="text-sm text-white/50 mt-1">사장님 대시보드에 오신 것을 환영합니다.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1">
          {([
            ['login', 'PIN 로그인'],
            ['join', '30초 참여'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setMode(key); setStep('phone'); setError(''); setPin(''); }}
              className={`rounded-xl py-2.5 text-sm font-bold transition ${
                mode === key ? 'bg-[#FF6F0F] text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'join' ? (
          joinDone ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
              <CheckCircle2 size={42} className="mx-auto text-green-400" />
              <h2 className="mt-4 text-lg font-black text-white">참여 신청 완료</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                관리자 확인 후 PIN 또는 빠른 참여 링크를 문자로 안내드릴게요.
              </p>
              <button
                onClick={() => { setMode('login'); setJoinDone(false); setStep('phone'); }}
                className="mt-5 w-full rounded-xl bg-[#FF6F0F] py-3 text-sm font-black text-white"
              >
                PIN 로그인으로 돌아가기
              </button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              {phoneInput}
              <label className="block">
                <span className="mb-2 flex items-center gap-1.5 text-xs text-white/50"><User size={13} />사장님 성함</span>
                <input
                  value={ownerName}
                  onChange={e => { setOwnerName(e.target.value); setError(''); }}
                  placeholder="홍길동"
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                />
              </label>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasAgency(v => !v);
                    setError('');
                    if (hasAgency) setAgencyName('');
                  }}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    hasAgency ? 'border-[#FF6F0F] bg-[#FF6F0F]' : 'border-white/20 bg-white/5'
                  }`}>
                    {hasAgency && <CheckCircle2 size={13} className="text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-white/75">광고대행사로 신청하기</span>
                    <span className="mt-0.5 block text-[11px] text-white/35">대행사가 사장님 대신 신청하는 경우 체크해주세요.</span>
                  </span>
                </button>
                {hasAgency && (
                  <input
                    value={agencyName}
                    onChange={e => { setAgencyName(e.target.value); setError(''); }}
                    placeholder="대행사명 또는 담당 업체명"
                    className="mt-3 h-11 w-full rounded-lg border border-white/10 bg-black/15 px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                  />
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="mb-2 flex items-center gap-1.5 text-xs text-white/50"><Search size={13} />가게 검색</span>
                <div className="flex gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/10 bg-black/15">
                    <input
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleStoreSearch();
                        }
                      }}
                      placeholder="가게명 또는 주소 검색"
                      className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setSearchResults(null); setSearchError(''); }}
                        className="px-3 text-white/35 hover:text-white/70"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleStoreSearch}
                    disabled={!searchQuery.trim() || searching}
                    className="flex w-12 items-center justify-center rounded-xl bg-[#FF6F0F] text-white disabled:opacity-40"
                  >
                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  </button>
                </div>
                {searchError && <p className="mt-2 text-xs text-red-300">{searchError}</p>}
                {searchResults && searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {searchResults.map((place, idx) => (
                      <button
                        key={`${place.place_name}-${idx}`}
                        type="button"
                        onClick={() => selectPlace(place)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-[#FF6F0F]/50 hover:bg-[#FF6F0F]/10"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-base">
                            {CATEGORIES.find(c => c.key === rawToCategory(place.category_raw))?.emoji ?? '🏪'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">{place.place_name}</p>
                            <p className="mt-0.5 truncate text-xs text-white/40">{place.road_address ?? place.address}</p>
                            {place.phone && <p className="text-xs text-white/35">{place.phone}</p>}
                          </div>
                          <span className="text-xs font-bold text-[#FFB37A]">선택</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-white/35">검색해서 선택하면 가게명, 주소, 전화번호, 좌표가 자동으로 채워집니다.</p>
              </div>
              <label className="block">
                <span className="mb-2 flex items-center gap-1.5 text-xs text-white/50"><Store size={13} />가게 이름</span>
                <input
                  value={storeName}
                  onChange={e => { setStoreName(e.target.value); setError(''); }}
                  placeholder="예: 상남백반"
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                />
              </label>
              <div>
                <span className="mb-2 block text-xs text-white/50">카테고리</span>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => { setCategory(c.key); setError(''); }}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold transition ${
                        category === c.key
                          ? 'border-[#FF6F0F]/70 bg-[#FF6F0F]/15 text-[#FFB37A]'
                          : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'
                      }`}
                    >
                      <span>{c.emoji}</span>
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-2 flex items-center gap-1.5 text-xs text-white/50"><Ticket size={13} />오늘 올릴 첫 혜택</span>
                <input
                  value={benefit}
                  onChange={e => { setBenefit(e.target.value); setSelectedSuggestion(null); setError(''); }}
                  placeholder="예: 오늘 2시~5시 라떼 1+1"
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                />
              </label>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-300" />
                  <span className="text-xs font-bold text-white/60">AI 혜택 추천</span>
                  <button
                    type="button"
                    onClick={fetchCouponSuggestions}
                    disabled={suggestLoading || !storeName.trim()}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg bg-violet-400/15 px-2.5 py-1.5 text-[11px] font-bold text-violet-200 transition hover:bg-violet-400/25 disabled:opacity-40"
                  >
                    {suggestLoading && <Loader2 size={11} className="animate-spin" />}
                    추천받기
                  </button>
                </div>
                {couponSuggestions && couponSuggestions.length > 0 ? (
                  <div className="grid gap-2">
                    {couponSuggestions.map((s) => (
                      <button
                        key={`${s.discount_type}-${s.title}`}
                        type="button"
                        onClick={() => {
                          setBenefit(s.title);
                          setSelectedSuggestion(s);
                          setError('');
                        }}
                        className={`rounded-xl border p-3 text-left transition ${
                          selectedSuggestion?.title === s.title
                            ? 'border-violet-300/60 bg-violet-300/15'
                            : 'border-white/10 bg-black/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-base">
                            {s.discount_type === 'free_item' ? '🎁' : s.discount_type === 'percent' ? '%' : '₩'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-white">{s.title}</p>
                            <p className="mt-1 text-[11px] text-white/40">
                              {[s.reason, s.target, s.best_time].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] leading-5 text-white/35">
                    가게 검색 후 누르면 업종과 상권에 맞는 첫 혜택을 3개 추천합니다.
                  </p>
                )}
              </div>
              <label className="block">
                <span className="mb-2 block text-xs text-white/50">가게 주소</span>
                <input
                  value={address}
                  onChange={e => { setAddress(e.target.value); setStoreLatLng(null); }}
                  placeholder="예: 창원 성산구 상남동 ..."
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={addressDetail}
                  onChange={e => setAddressDetail(e.target.value)}
                  placeholder="상세주소 선택"
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                />
                <input
                  value={storePhone}
                  onChange={e => setStorePhone(e.target.value)}
                  placeholder="가게 전화 선택"
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                />
              </div>
              <label className="block">
                <span className="mb-2 flex items-center gap-1.5 text-xs text-white/50"><FileText size={13} />사업자 확인</span>
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <input
                    value={businessNumber}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setBusinessNumber(digits.replace(/(\d{3})(\d{0,2})(\d{0,5})/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-')));
                      setError('');
                    }}
                    inputMode="numeric"
                    placeholder="사업자번호 10자리"
                    className="h-11 w-full rounded-lg border border-white/10 bg-black/15 px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
                  />
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => {
                      setLicenseFile(e.target.files?.[0] ?? null);
                      setError('');
                    }}
                    className="block w-full text-xs text-white/55 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                  />
                  <p className="mt-2 text-[11px] leading-5 text-white/35">
                    V1은 사업자번호만 입력해도 신청할 수 있습니다. 사진이 있으면 검수가 더 빨라집니다.
                  </p>
                </div>
              </label>
              <div>
                <span className="mb-2 flex items-center gap-1.5 text-xs text-white/50"><Navigation size={13} />가게에서 GPS 위치 확인 선택사항</span>
                <button
                  type="button"
                  onClick={verifyGps}
                  disabled={gpsLoading}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    gps
                      ? 'border-green-400/30 bg-green-400/10 text-green-300'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {gpsLoading ? <Loader2 size={16} className="animate-spin" /> : gps ? <CheckCircle2 size={16} /> : <Navigation size={16} />}
                  {gps ? `위치 저장됨 · 정확도 ${Math.round(gps.accuracy)}m` : '현재 위치 남기기'}
                </button>
                <p className="mt-2 text-[11px] leading-5 text-white/35">
                  GPS는 참고자료라 생략해도 신청할 수 있습니다. 남겨주신 좌표는 관리자가 지도에서 확인합니다.
                </p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6F0F] py-3 text-base font-bold text-white transition hover:bg-[#e86200] disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                참여 신청하기
              </button>
              <p className="text-center text-[11px] leading-5 text-white/35">
                신청 후 관리자가 확인하면 PIN 또는 빠른 참여 링크를 보내드립니다.
              </p>
            </form>
          )
        ) : step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            {phoneInput}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={mid.length !== 4 || last.length !== 4}
              className="w-full py-3 rounded-xl bg-[#FF6F0F] text-white font-bold text-base hover:bg-[#e86200] transition disabled:opacity-40"
            >
              다음
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-xs text-white/50 mb-1">
                <button
                  onClick={() => { setStep('phone'); setPin(''); setError(''); }}
                  className="underline hover:text-white/80 transition"
                >
                  {displayPhone}
                </button>
              </p>
              <p className="text-sm text-white/70">4자리 PIN을 입력해주세요</p>
            </div>

            {/* PIN 표시 */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                    i < pin.length
                      ? 'bg-[#FF6F0F] border-[#FF6F0F]'
                      : 'bg-white/5 border-white/20'
                  }`}
                >
                  {i < pin.length && <div className="w-3 h-3 rounded-full bg-white" />}
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            {/* 숫자 패드 */}
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={28} className="animate-spin text-[#FF6F0F]" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {PAD.map((key, i) => {
                  if (key === '') return <div key={i} />;
                  if (key === '⌫') return (
                    <button
                      key={i}
                      onClick={deletePin}
                      className="h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition active:scale-95"
                    >
                      <Delete size={20} />
                    </button>
                  );
                  return (
                    <button
                      key={i}
                      onClick={() => appendPin(key)}
                      className="h-14 rounded-xl bg-white/8 border border-white/10 text-white text-xl font-semibold hover:bg-white/15 transition active:scale-95"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
