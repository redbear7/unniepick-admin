'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, Store, MapPin, Check, ChevronRight, Loader2, CheckCircle } from 'lucide-react';

const AREAS = [
  '상남동', '반송동', '중앙동', '용호동', '팔용동',
  '마산합포구', '마산회원구', '진해구', '의창구', '성산구', '기타',
];

function formatPhone(val: string) {
  const nums = val.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
}

export default function ConsultPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    owner_name: '',
    phone: '010-',
    business_name: '',
    area: '',
    has_agency: false,
    agency_name: '',
    memo: '',
  });

  const isValid =
    form.owner_name.trim().length > 0 &&
    form.phone.replace(/\D/g, '').length >= 10 &&
    form.business_name.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '오류가 발생했습니다.'); return; }
      router.push(`/consult/chat/${data.token}`);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-5 h-14 flex items-center gap-2">
        <span className="text-xl">🌸</span>
        <span className="text-[17px] font-bold text-gray-900">창원언니쓰 × 언니픽</span>
      </header>

      <main className="flex-1 px-5 py-8 max-w-[480px] mx-auto w-full">
        {/* 인트로 */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-[#FF6F0F] text-[12px] font-semibold rounded-full mb-3">
            <CheckCircle className="w-3.5 h-3.5" />
            무료 광고 상담
          </div>
          <h1 className="text-[24px] font-bold text-gray-900 leading-snug">
            창원언니쓰 광고 상담<br />
            신청해 주세요
          </h1>
          <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">
            상담 후 언니픽에 가게 등록하시면<br />
            창원 최대 맛집 채널에 소개됩니다 🌸
          </p>
        </div>

        <div className="space-y-4">
          {/* 대표자명 */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <User className="w-3.5 h-3.5 text-[#FF6F0F]" />
              대표자명 <span className="text-[#FF6F0F]">*</span>
            </span>
            <input
              type="text"
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              placeholder="홍길동"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all"
            />
          </label>

          {/* 연락처 */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Phone className="w-3.5 h-3.5 text-[#FF6F0F]" />
              연락처 <span className="text-[#FF6F0F]">*</span>
            </span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => {
                const nums = e.target.value.replace(/\D/g, '');
                setForm({ ...form, phone: nums.length < 3 ? '010-' : formatPhone(nums) });
              }}
              placeholder="010-1234-5678"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all"
            />
          </label>

          {/* 업체명 */}
          <label className="block">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <Store className="w-3.5 h-3.5 text-[#FF6F0F]" />
              업체명 <span className="text-[#FF6F0F]">*</span>
            </span>
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              placeholder="맛있는 식당"
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all"
            />
          </label>

          {/* 상권 */}
          <div>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#FF6F0F]" />
              상권 위치
            </span>
            <div className="flex flex-wrap gap-2">
              {AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setForm({ ...form, area })}
                  className={`px-3 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                    form.area === area
                      ? 'bg-[#FF6F0F] text-white border-[#FF6F0F]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#FF6F0F]/50'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          {/* 광고 대행사 체크 */}
          <div className="bg-orange-50 rounded-2xl p-4">
            <button
              type="button"
              onClick={() => setForm({ ...form, has_agency: !form.has_agency, agency_name: '' })}
              className="flex items-center gap-3 w-full"
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${form.has_agency ? 'bg-[#FF6F0F]' : 'bg-white border-2 border-gray-200'}`}>
                {form.has_agency && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div className="text-left">
                <p className="text-[14px] font-semibold text-gray-800">현재 광고 대행사 이용 중</p>
                <p className="text-[12px] text-gray-500">다른 광고 대행사를 사용하고 있어요</p>
              </div>
            </button>
            {form.has_agency && (
              <div className="mt-3 pt-3 border-t border-orange-100">
                <input
                  type="text"
                  value={form.agency_name}
                  onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                  placeholder="대행사명 (선택)"
                  className="w-full px-3 py-2.5 bg-white border border-orange-200 rounded-xl text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] transition-all"
                />
              </div>
            )}
          </div>

          {/* 추가 문의 */}
          <label className="block">
            <span className="text-[13px] font-semibold text-gray-700 mb-1.5 block">
              추가 문의사항 <span className="text-gray-400 font-normal">(선택)</span>
            </span>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="궁금하신 점을 자유롭게 적어주세요"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#FF6F0F] focus:ring-2 focus:ring-[#FF6F0F]/10 transition-all resize-none"
            />
          </label>

          {error && <p className="text-[14px] text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="w-full py-4 bg-[#FF6F0F] text-white font-bold rounded-xl text-[17px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-orange-200"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                상담 신청하기
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
