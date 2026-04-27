'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  Search, X, Loader2, Check, ArrowLeft,
  Building2, User, Phone, Upload, FileText, ChevronRight, MapPin,
} from 'lucide-react';

// ── 창원 5개 구 + 기타 ─────────────────────────────────────────────────────────
const DISTRICTS = ['의창구', '성산구', '마산합포구', '마산회원구', '진해구', '기타'];

interface SearchPlace {
  place_name: string;
  address: string;
  road_address: string | null;
  phone: string | null;
  category_raw: string;
  place_url: string | null;
}

// 하위 호환용 alias
type KakaoPlace = SearchPlace & { kakao_id: string };

type SearchEngine = 'kakao' | 'naver';

function detectDistrict(address: string): string {
  for (const d of ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'])
    if (address.includes(d)) return d;
  return '';
}

function formatPhone(val: string) {
  const n = val.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
}

type Step = 'search' | 'confirm' | 'agency';

export default function ConsultPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('search');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 검색
  const [engine, setEngine] = useState<SearchEngine>('naver');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // 업체 확인 (일반)
  const [businessName, setBusinessName] = useState('');
  const [area, setArea] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<SearchPlace | null>(null);

  // 광고대행사
  const [agencyName, setAgencyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [cardFile, setCardFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 검색 (카카오 / 네이버) ────────────────────────────────────────────────────
  const handleSearch = async (eng: SearchEngine = engine) => {
    const q = query.trim();
    if (!q) return;
    setSearching(true); setSearchError(''); setResults(null);
    try {
      let url: string;
      if (eng === 'kakao') {
        let coords = '';
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
          );
          coords = `&x=${pos.coords.longitude}&y=${pos.coords.latitude}`;
        } catch { /* 위치 없이 검색 */ }
        url = `/api/kakao-place?q=${encodeURIComponent(q)}${coords}&size=5`;
      } else {
        url = `/api/naver-place?q=${encodeURIComponent(q)}&size=5`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '검색 실패');
      setResults(data.places ?? []);
      if (!(data.places ?? []).length) setSearchError('검색 결과가 없어요. 직접 입력해주세요.');
    } catch (e: unknown) {
      setSearchError((e as Error).message ?? '검색 중 오류');
    } finally { setSearching(false); }
  };

  const handleSelectPlace = (place: SearchPlace) => {
    setSelectedPlace(place);
    setBusinessName(place.place_name);
    setArea(detectDistrict(place.road_address ?? place.address));
    setStep('confirm');
  };

  // ── 제출 공통 ────────────────────────────────────────────────────────────────
  const submitConsult = async (body: Record<string, unknown>) => {
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '오류가 발생했습니다.'); return false; }
      router.push(`/consult/chat/${data.token}`);
      return true;
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      return false;
    } finally { setSubmitting(false); }
  };

  // ── 일반 업체 제출 ───────────────────────────────────────────────────────────
  const handleSubmitBusiness = () => submitConsult({
    business_name: businessName.trim(),
    area,
    has_agency: false,
    memo: selectedPlace?.place_url ? `${engine === 'naver' ? '네이버' : '카카오'}: ${selectedPlace.place_url}` : null,
  });

  // ── 광고대행사 제출 ──────────────────────────────────────────────────────────
  const handleSubmitAgency = async () => {
    if (!agencyName.trim()) return;
    setSubmitting(true); setError('');
    try {
      let cardUrl: string | null = null;
      if (cardFile) {
        const ext = cardFile.name.split('.').pop() ?? 'jpg';
        const path = `cards/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('consult-files').upload(path, cardFile);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('consult-files').getPublicUrl(path);
          cardUrl = publicUrl;
        }
      }
      await submitConsult({
        business_name: agencyName.trim(),
        area: null,
        owner_name: managerName.trim() || null,
        phone: managerPhone.replace(/\D/g, '') || null,
        has_agency: true,
        agency_name: null,
        memo: cardUrl ? `명함: ${cardUrl}` : null,
      });
    } finally { setSubmitting(false); }
  };

  // ── 공통 헤더 ────────────────────────────────────────────────────────────────
  const Header = ({ onBack }: { onBack?: () => void }) => (
    <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-2">
      {onBack && (
        <button onClick={onBack} className="p-1.5 -ml-1 text-gray-400 hover:text-gray-700 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <span className="text-lg">🌸</span>
      <span className="text-[16px] font-bold text-gray-900">창원언니쓰 상담</span>
    </header>
  );

  // ── STEP: 검색 ───────────────────────────────────────────────────────────────
  if (step === 'search') return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col px-5 pt-8 pb-6 max-w-[480px] mx-auto w-full">

        {/* 인트로 */}
        <div className="mb-7">
          <p className="text-[28px] mb-2">👋</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-snug">
            가게를 검색해주세요
          </h1>
          <p className="text-[14px] text-gray-400 mt-1.5 leading-relaxed">
            카카오에 등록된 가게라면 정보를 바로 불러와요
          </p>
        </div>

        {/* 검색 엔진 탭 */}
        <div className="flex gap-1.5 mb-3 p-1 bg-gray-100 rounded-2xl">
          <button
            onClick={() => { setEngine('naver'); setResults(null); setSearchError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all shadow-sm ${
              engine === 'naver'
                ? 'bg-[#03C75A] text-white'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            네이버
          </button>
          <button
            onClick={() => { setEngine('kakao'); setResults(null); setSearchError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all shadow-sm ${
              engine === 'kakao'
                ? 'bg-[#FEE500] text-[#3A1D1D]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            카카오
          </button>
        </div>

        {/* 검색창 */}
        <div className="mb-3">
          <div className="flex gap-2">
            <div className={`flex-1 flex items-center border-2 rounded-2xl overflow-hidden bg-white transition-colors ${
              engine === 'kakao' ? 'focus-within:border-[#FEE500]' : 'focus-within:border-[#03C75A]'
            } border-gray-200`}>
              <span className="pl-4 shrink-0">
                {engine === 'kakao' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#3A1D1D">
                    <path d="M12 3C6.477 3 2 6.477 2 10.6c0 2.7 1.707 5.073 4.29 6.424l-.895 3.312a.4.4 0 00.59.44L10.04 18.3a11.3 11.3 0 001.96.17c5.523 0 10-3.477 10-7.87C22 6.477 17.523 3 12 3z"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#03C75A">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                  </svg>
                )}
              </span>
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setSearchError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="가게 이름 또는 주소 검색"
                className="flex-1 px-3 py-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
              />
              {query && (
                <button onClick={() => { setQuery(''); setResults(null); setSearchError(''); }}
                  className="pr-3 text-gray-400"><X className="w-4 h-4" /></button>
              )}
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim() || searching}
              className={`shrink-0 w-14 flex items-center justify-center rounded-2xl disabled:opacity-40 transition hover:opacity-90 ${
                engine === 'naver' ? 'bg-[#03C75A]' : 'bg-[#FEE500]'
              }`}
            >
              {searching
                ? <Loader2 className={`w-5 h-5 animate-spin ${engine === 'naver' ? 'text-white' : 'text-[#3A1D1D]'}`} />
                : <Search className={`w-5 h-5 ${engine === 'naver' ? 'text-white' : 'text-[#3A1D1D]'}`} />}
            </button>
          </div>
          {searchError && <p className="mt-2 text-[13px] text-red-500 px-1">{searchError}</p>}
        </div>

        {/* 검색 결과 */}
        {results !== null && results.length > 0 && (
          <div className="space-y-2 mb-4">
            {results.map((place, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectPlace(place)}
                className="w-full flex items-start gap-3 p-4 bg-white border-2 border-gray-100 hover:border-[#FEE500] hover:bg-yellow-50 rounded-2xl text-left transition group"
              >
                <span className="w-9 h-9 rounded-xl bg-yellow-50 group-hover:bg-yellow-100 flex items-center justify-center shrink-0 text-lg transition">
                  🏪
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-[14px]">{place.place_name}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5 truncate">{place.road_address ?? place.address}</p>
                  {place.phone && <p className="text-[12px] text-gray-400">{place.phone}</p>}
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-[#FF6F0F] opacity-0 group-hover:opacity-100 transition mt-1">
                  선택 →
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 하단 버튼들 */}
        <div className="mt-auto pt-4 space-y-3">
          <button
            onClick={() => { setSelectedPlace(null); setBusinessName(''); setArea(''); setStep('confirm'); }}
            className="w-full py-4 rounded-2xl border-2 border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800 font-semibold text-[14px] transition"
          >
            네이버, 카카오에 아직 없어요 → 직접 입력할게요
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[12px] text-gray-400 shrink-0">또는</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            onClick={() => setStep('agency')}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#FF6F0F]/40 hover:bg-orange-50 text-gray-500 hover:text-[#FF6F0F] font-semibold text-[14px] transition flex items-center justify-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            광고대행사입니다
          </button>
        </div>
      </main>
    </div>
  );

  // ── STEP: 업체 확인 (일반) ───────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <Header onBack={() => setStep('search')} />
      <main className="flex-1 px-5 py-8 max-w-[480px] mx-auto w-full">

        {/* 자동입력 뱃지 */}
        {selectedPlace && (
          engine === 'naver' ? (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#03C75A" className="shrink-0">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
              <span className="text-[12px] font-semibold text-green-800 flex-1">네이버에서 정보를 불러왔어요 — 확인 후 입장하세요</span>
              <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#92661a" className="shrink-0">
                <path d="M12 3C6.477 3 2 6.477 2 10.6c0 2.7 1.707 5.073 4.29 6.424l-.895 3.312a.4.4 0 00.59.44L10.04 18.3a11.3 11.3 0 001.96.17c5.523 0 10-3.477 10-7.87C22 6.477 17.523 3 12 3z"/>
              </svg>
              <span className="text-[12px] font-semibold text-yellow-800 flex-1">카카오에서 정보를 불러왔어요 — 확인 후 입장하세요</span>
              <Check className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
            </div>
          )
        )}

        <div className="mb-7">
          <h1 className="text-[22px] font-bold text-gray-900">업체 정보 확인</h1>
          <p className="text-[14px] text-gray-400 mt-1">내용을 확인하고 상담 채팅방에 입장하세요</p>
        </div>

        <div className="space-y-5">
          {/* 상호명 */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#FF6F0F]" />
              상호명 <span className="text-[#FF6F0F]">*</span>
            </span>
            <input
              autoFocus={!selectedPlace}
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="맛있는 식당"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all"
            />
          </label>

          {/* 상권 (구) */}
          <div>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-2">
              <MapPin className="w-3.5 h-3.5 text-[#FF6F0F]" />
              상권 (구) <span className="text-[#FF6F0F]">*</span>
            </span>
            <div className="grid grid-cols-3 gap-2">
              {DISTRICTS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setArea(d)}
                  className={`py-3 rounded-xl text-[13px] font-semibold border-2 transition-all ${
                    area === d
                      ? 'bg-[#FF6F0F] text-white border-[#FF6F0F]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#FF6F0F]/40'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <button
            onClick={handleSubmitBusiness}
            disabled={!businessName.trim() || !area || submitting}
            className="w-full py-4 bg-[#FF6F0F] text-white font-bold rounded-xl text-[17px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-orange-200 mt-2"
          >
            {submitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><span>상담 채팅방 입장</span><ChevronRight className="w-5 h-5" /></>}
          </button>
        </div>
      </main>
    </div>
  );

  // ── STEP: 광고대행사 ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <Header onBack={() => setStep('search')} />
      <main className="flex-1 px-5 py-8 max-w-[480px] mx-auto w-full">

        <div className="mb-7">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-[#FF6F0F] text-[12px] font-semibold rounded-full mb-3">
            <Building2 className="w-3.5 h-3.5" />
            광고대행사 상담
          </div>
          <h1 className="text-[22px] font-bold text-gray-900">대행사 정보를 입력해주세요</h1>
          <p className="text-[14px] text-gray-400 mt-1">상호만 입력해도 바로 입장할 수 있어요</p>
        </div>

        <div className="space-y-4">
          {/* 상호 (필수) */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#FF6F0F]" />
              대행사 상호 <span className="text-[#FF6F0F]">*</span>
            </span>
            <input
              autoFocus
              type="text"
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              placeholder="예: 마케팅홍 에이전시"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all"
            />
          </label>

          {/* 담당자 (선택) */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              담당자 이름 <span className="text-[12px] text-gray-400 font-normal">(선택)</span>
            </span>
            <input
              type="text"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all"
            />
          </label>

          {/* 휴대폰 (선택) */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              휴대폰 <span className="text-[12px] text-gray-400 font-normal">(선택)</span>
            </span>
            <input
              type="tel"
              value={managerPhone}
              onChange={e => {
                const n = e.target.value.replace(/\D/g, '');
                setManagerPhone(n.length < 3 ? n : formatPhone(n));
              }}
              placeholder="010-1234-5678"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all"
            />
          </label>

          {/* 명함 업로드 (선택) */}
          <div>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Upload className="w-3.5 h-3.5 text-gray-400" />
              명함 업로드 <span className="text-[12px] text-gray-400 font-normal">(선택)</span>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => setCardFile(e.target.files?.[0] ?? null)}
            />
            {cardFile ? (
              <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-[#FF6F0F]/30 rounded-xl">
                <FileText className="w-5 h-5 text-[#FF6F0F] shrink-0" />
                <span className="flex-1 text-[14px] text-gray-700 truncate">{cardFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setCardFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-dashed border-gray-300 hover:border-[#FF6F0F]/50 hover:bg-orange-50 rounded-xl text-[14px] text-gray-500 hover:text-[#FF6F0F] font-medium transition"
              >
                <Upload className="w-4 h-4" />
                사진/파일 선택
              </button>
            )}
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <button
            onClick={handleSubmitAgency}
            disabled={!agencyName.trim() || submitting}
            className="w-full py-4 bg-[#FF6F0F] text-white font-bold rounded-xl text-[17px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-orange-200 mt-2"
          >
            {submitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><span>상담 채팅방 입장</span><ChevronRight className="w-5 h-5" /></>}
          </button>
        </div>
      </main>
    </div>
  );
}
