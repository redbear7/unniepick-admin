'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { ChevronRight, ChevronLeft, Check, Store, User, MapPin, Phone, Tag, Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types & constants                                                    */
/* ------------------------------------------------------------------ */

interface FormData {
  owner_name:     string;
  owner_phone:    string;
  store_name:     string;
  store_category: string;
  store_address:  string;
  store_phone:    string;
}

const EMPTY: FormData = {
  owner_name:     '',
  owner_phone:    '',
  store_name:     '',
  store_category: '',
  store_address:  '',
  store_phone:    '',
};

const CATEGORIES = ['카페', '음식점', '베이커리', '바/펍', '디저트', '패스트푸드', '기타'];

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function ApplyPage() {
  const [step,        setStep]        = useState<1 | 2 | 3>(1);
  const [form,        setForm]        = useState<FormData>(EMPTY);
  const [naverUrl,    setNaverUrl]    = useState('');
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillErr, setAutoFillErr] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState('');

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  /* ---- 네이버 자동 입력 ---- */
  const handleNaverAutoFill = async () => {
    if (!naverUrl.trim()) return;
    setAutoFilling(true);
    setAutoFillErr('');
    try {
      const res  = await fetch(`/api/naver-place?url=${encodeURIComponent(naverUrl.trim())}`);
      const data = await res.json();
      if (data.error) { setAutoFillErr(data.error); return; }
      setForm(f => ({
        ...f,
        store_name:     data.name     || f.store_name,
        store_address:  data.address  || f.store_address,
        store_phone:    data.phone    || f.store_phone,
        store_category: data.category || f.store_category,
      }));
      if (data.latitude || data.longitude) {
        setAutoFillErr('');
      }
    } catch {
      setAutoFillErr('네트워크 오류가 발생했습니다');
    } finally {
      setAutoFilling(false);
    }
  };

  /* ---- 제출 ---- */
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const sb = createClient();
      const { error: err } = await sb.from('store_requests').insert({
        owner_name:     form.owner_name.trim(),
        owner_phone:    form.owner_phone.trim() || null,
        store_name:     form.store_name.trim(),
        store_category: form.store_category.trim() || null,
        store_address:  form.store_address.trim() || null,
        store_phone:    form.store_phone.trim() || null,
        status:         'pending',
      });
      if (err) throw err;
      setDone(true);
    } catch {
      setError('제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const step1Valid = form.owner_name.trim().length > 0 && form.owner_phone.trim().length > 0;
  const step2Valid = form.store_name.trim().length > 0;

  /* ---------------------------------------------------------------- */
  /* Done screen                                                        */
  /* ---------------------------------------------------------------- */
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-6">
          <Check size={36} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-3">신청 완료!</h1>
        <p className="text-tertiary text-sm leading-relaxed">
          가게 등록 신청이 접수되었습니다.<br />
          검토 후 영업일 1~2일 내에 연락드릴게요.
        </p>
        <div className="mt-8 bg-card border border-border-main rounded-2xl p-5 w-full max-w-sm text-left space-y-2">
          <p className="text-xs text-dim mb-3 font-semibold uppercase tracking-wider">신청 내용</p>
          <Row label="신청자"  value={form.owner_name} />
          <Row label="연락처"  value={form.owner_phone} />
          <Row label="가게명"  value={form.store_name} />
          {form.store_category && <Row label="카테고리" value={form.store_category} />}
          {form.store_address  && <Row label="주소"     value={form.store_address} />}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Form                                                               */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더 */}
      <div className="px-5 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#FF6F0F] flex items-center justify-center text-lg shrink-0">🍖</div>
          <div>
            <p className="text-primary font-bold text-base leading-none">언니픽</p>
            <p className="text-muted text-xs mt-0.5">가게 등록 신청</p>
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center gap-2">
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step > s  ? 'bg-[#FF6F0F] text-primary' :
                step === s ? 'bg-[#FF6F0F] text-primary ring-4 ring-[#FF6F0F]/20' :
                             'bg-fill-medium text-muted'
              }`}>
                {step > s ? <Check size={12} /> : s}
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 w-8 rounded ${step > s ? 'bg-[#FF6F0F]' : 'bg-fill-medium'}`} />}
            </div>
          ))}
          <div className="ml-3 text-xs text-muted">
            {step === 1 ? '신청자 정보' : step === 2 ? '가게 정보' : '최종 확인'}
          </div>
        </div>
      </div>

      {/* 폼 영역 */}
      <div className="flex-1 px-5 pb-8">

        {/* ── Step 1: 신청자 정보 ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-primary mb-1">신청자 정보를 입력해 주세요</h2>
              <p className="text-sm text-muted">가게 담당자(사장님)의 정보를 입력하세요</p>
            </div>

            <Field icon={<User size={16} />} label="이름 *">
              <input
                value={form.owner_name}
                onChange={set('owner_name')}
                placeholder="홍길동"
                className={inputCls}
              />
            </Field>

            <Field icon={<Phone size={16} />} label="연락처 *">
              <input
                value={form.owner_phone}
                onChange={set('owner_phone')}
                placeholder="010-0000-0000"
                inputMode="tel"
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {/* ── Step 2: 가게 정보 ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-primary mb-1">가게 정보를 입력해 주세요</h2>
              <p className="text-sm text-muted">네이버 업체 URL로 자동 입력할 수 있어요</p>
            </div>

            {/* 네이버 자동 입력 */}
            <div className="bg-card border border-border-main rounded-2xl p-4">
              <p className="text-xs font-semibold text-tertiary mb-3 flex items-center gap-1.5">
                <span className="w-4 h-4 bg-[#03C75A] rounded flex items-center justify-center text-[10px] font-black text-primary">N</span>
                네이버 업체 URL로 자동 입력
              </p>
              <div className="flex gap-2">
                <input
                  value={naverUrl}
                  onChange={e => { setNaverUrl(e.target.value); setAutoFillErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleNaverAutoFill()}
                  placeholder="네이버 지도 업체 URL 붙여넣기"
                  className="flex-1 min-w-0 bg-sidebar border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#03C75A] transition"
                />
                <button
                  onClick={handleNaverAutoFill}
                  disabled={autoFilling || !naverUrl.trim()}
                  className="shrink-0 px-4 py-2.5 bg-[#03C75A] hover:bg-[#02b050] disabled:opacity-50 text-primary text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  {autoFilling ? <Loader2 size={13} className="animate-spin" /> : null}
                  {autoFilling ? '조회 중' : '자동 입력'}
                </button>
              </div>
              {autoFillErr && <p className="mt-2 text-xs text-red-400">{autoFillErr}</p>}
            </div>

            <Field icon={<Store size={16} />} label="가게명 *">
              <input
                value={form.store_name}
                onChange={set('store_name')}
                placeholder="가게 이름"
                className={inputCls}
              />
            </Field>

            <Field icon={<Tag size={16} />} label="카테고리">
              <div className="flex flex-wrap gap-2 mb-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setForm(f => ({ ...f, store_category: cat }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      form.store_category === cat
                        ? 'bg-[#FF6F0F] text-primary'
                        : 'bg-fill-subtle text-tertiary hover:bg-fill-medium'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                value={form.store_category}
                onChange={set('store_category')}
                placeholder="직접 입력"
                className={inputCls}
              />
            </Field>

            <Field icon={<MapPin size={16} />} label="주소">
              <input
                value={form.store_address}
                onChange={set('store_address')}
                placeholder="가게 주소"
                className={inputCls}
              />
            </Field>

            <Field icon={<Phone size={16} />} label="가게 연락처">
              <input
                value={form.store_phone}
                onChange={set('store_phone')}
                placeholder="055-000-0000"
                inputMode="tel"
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {/* ── Step 3: 최종 확인 ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-primary mb-1">내용을 확인해 주세요</h2>
              <p className="text-sm text-muted">제출 후에는 수정이 어려워요</p>
            </div>

            <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
              <SectionLabel>신청자</SectionLabel>
              <Row label="이름"   value={form.owner_name} />
              <Row label="연락처" value={form.owner_phone} />
              <div className="border-t border-border-main pt-3 mt-3">
                <SectionLabel>가게</SectionLabel>
              </div>
              <Row label="가게명"    value={form.store_name} />
              <Row label="카테고리"  value={form.store_category || '-'} />
              <Row label="주소"      value={form.store_address  || '-'} />
              <Row label="연락처"    value={form.store_phone    || '-'} />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="px-5 pb-10 pt-4 border-t border-border-main flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
            className="flex items-center gap-1.5 px-5 py-3.5 rounded-2xl bg-fill-subtle text-tertiary text-sm font-semibold hover:bg-fill-medium transition"
          >
            <ChevronLeft size={16} /> 이전
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
            disabled={step === 1 ? !step1Valid : !step2Valid}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#FF6F0F] hover:bg-[#e66000] disabled:opacity-40 text-primary text-sm font-bold transition"
          >
            다음 <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#FF6F0F] hover:bg-[#e66000] disabled:opacity-60 text-primary text-sm font-bold transition"
          >
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> 제출 중...</>
              : <><Check size={16} /> 신청 완료</>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                        */
/* ------------------------------------------------------------------ */

const inputCls = 'w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition';

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-tertiary mb-2">
        <span className="text-dim">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-dim uppercase tracking-wider">{children}</p>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className="text-xs text-primary text-right">{value}</span>
    </div>
  );
}
