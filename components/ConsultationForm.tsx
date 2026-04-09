'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';

const CONSULTATION_TYPES = [
  { value: 'general',         label: '일반 문의' },
  { value: 'store_register',  label: '가게 등록' },
  { value: 'service',         label: '서비스 이용' },
  { value: 'other',           label: '기타' },
] as const;

type ConsultationType = typeof CONSULTATION_TYPES[number]['value'];

export default function ConsultationForm() {
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [type,       setType]       = useState<ConsultationType>('general');
  const [content,    setContent]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim())    { setError('이름을 입력해 주세요'); return; }
    if (!phone.trim())   { setError('연락처를 입력해 주세요'); return; }
    if (!content.trim()) { setError('상담 내용을 입력해 주세요'); return; }
    if (content.trim().length < 10) { setError('상담 내용을 10자 이상 입력해 주세요'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    name.trim(),
          phone:   phone.trim(),
          email:   email.trim() || undefined,
          type,
          content: content.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출에 실패했습니다');
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-primary">상담 신청 완료!</h2>
        <p className="text-sm text-muted leading-relaxed">
          상담 신청이 접수되었습니다.<br />
          영업일 1~2일 내에 연락드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-5">
      {/* 이름 / 연락처 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-tertiary mb-1.5">이름 *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="홍길동"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-tertiary mb-1.5">연락처 *</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            inputMode="tel"
            className={inputCls}
          />
        </div>
      </div>

      {/* 이메일 */}
      <div>
        <label className="block text-xs font-semibold text-tertiary mb-1.5">
          이메일 <span className="font-normal text-dim">(선택)</span>
        </label>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="example@email.com"
          type="email"
          inputMode="email"
          className={inputCls}
        />
      </div>

      {/* 상담 유형 */}
      <div>
        <label className="block text-xs font-semibold text-tertiary mb-1.5">상담 유형</label>
        <div className="flex flex-wrap gap-2">
          {CONSULTATION_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                type === t.value
                  ? 'bg-[#FF6F0F] border-[#FF6F0F] text-white'
                  : 'bg-sidebar border-border-subtle text-tertiary hover:border-[#FF6F0F]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 상담 내용 */}
      <div>
        <label className="block text-xs font-semibold text-tertiary mb-1.5">상담 내용 *</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="문의하실 내용을 10자 이상 입력해 주세요"
          rows={5}
          className={`${inputCls} resize-none`}
        />
        <p className="text-xs text-dim mt-1 text-right">{content.trim().length}자</p>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#FF6F0F] hover:bg-[#e66000] disabled:opacity-40 text-white font-bold text-base transition"
      >
        {submitting
          ? <><Loader2 size={16} className="animate-spin" /> 제출 중...</>
          : '상담 신청하기'}
      </button>
    </form>
  );
}

const inputCls =
  'w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-muted focus:outline-none focus:border-[#FF6F0F] transition';
