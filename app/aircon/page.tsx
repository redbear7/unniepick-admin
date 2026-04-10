'use client';

import { useState } from 'react';
import { Check, Loader2, Wind, Calendar, ChevronRight, Minus, Plus, MapPin } from 'lucide-react';

const ACCENT = '#0EA5E9';

const SERVICE_TYPES = [
  { key: '설치', label: '설치', emoji: '🔧', desc: '새 에어컨 설치' },
  { key: '이전', label: '이전', emoji: '📦', desc: '다른 곳으로 이동' },
  { key: '철거', label: '철거', emoji: '🗑️', desc: '에어컨 제거' },
] as const;

type ServiceType = typeof SERVICE_TYPES[number]['key'];

const PRICE_GUIDE: Record<string, { wall: string; stand: string }> = {
  설치: { wall: '50,000원~', stand: '80,000원~' },
  이전: { wall: '80,000원~', stand: '120,000원~' },
  철거: { wall: '30,000원~', stand: '50,000원~' },
};

const LOCATION_OPTIONS = ['거실', '안방', '작은방', '주방', '사무실', '기타'];

export default function AirconPage() {
  const [serviceType, setServiceType] = useState<ServiceType | ''>('');
  const [unitCount, setUnitCount] = useState(1);
  const [location, setLocation] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const isValid = serviceType && name.trim() && phone.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/aircon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: serviceType,
          unit_count: unitCount,
          location: location || null,
          user_name: name.trim(),
          user_phone: phone.trim(),
          address: address.trim() || null,
          preferred_date: preferredDate || null,
          memo: memo.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출 실패');
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? '오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: `${ACCENT}22` }}
        >
          <Check size={36} style={{ color: ACCENT }} />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-3">상담 신청 완료!</h1>
        <p className="text-tertiary text-sm leading-relaxed">
          에어컨 {serviceType} 상담 신청이 접수되었습니다.<br />
          영업일 1~2일 내에 연락드릴게요.
        </p>
      </div>
    );
  }

  const priceInfo = serviceType ? PRICE_GUIDE[serviceType] : null;

  return (
    <div className="flex-1 flex flex-col items-center px-5 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* 헤더 */}
        <div className="text-center mb-2">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-4"
            style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
          >
            <Wind size={13} /> 에어컨 서비스
          </div>
          <h1 className="text-2xl font-bold text-primary">에어컨 상담 신청</h1>
          <p className="text-sm text-muted mt-1">원하는 서비스를 선택하고 간단히 신청하세요</p>
        </div>

        {/* 서비스 유형 선택 */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-tertiary">서비스 유형 *</p>
          <div className="grid grid-cols-3 gap-3">
            {SERVICE_TYPES.map(({ key, label, emoji, desc }) => {
              const active = serviceType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setServiceType(key)}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-xl border text-sm font-semibold transition"
                  style={
                    active
                      ? { backgroundColor: `${ACCENT}18`, borderColor: ACCENT, color: ACCENT }
                      : {
                          backgroundColor: 'var(--bg-sidebar)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-tertiary)',
                        }
                  }
                >
                  <span className="text-2xl">{emoji}</span>
                  <span>{label}</span>
                  <span className="text-[10px] font-normal opacity-70">{desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 대수 입력 */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-tertiary">에어컨 대수 *</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">설치/작업할 에어컨 대수</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUnitCount(c => Math.max(1, c - 1))}
                className="w-9 h-9 rounded-xl border border-border-subtle bg-sidebar flex items-center justify-center text-tertiary hover:text-primary transition"
              >
                <Minus size={14} />
              </button>
              <span
                className="w-8 text-center text-xl font-bold"
                style={{ color: ACCENT }}
              >
                {unitCount}
              </span>
              <button
                type="button"
                onClick={() => setUnitCount(c => Math.min(10, c + 1))}
                className="w-9 h-9 rounded-xl border border-border-subtle bg-sidebar flex items-center justify-center text-tertiary hover:text-primary transition"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-dim">최대 10대까지 신청 가능합니다</p>
        </div>

        {/* 설치 장소 */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-tertiary flex items-center gap-1.5">
            <MapPin size={13} className="text-dim" /> 설치 장소 <span className="font-normal text-dim">(선택)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {LOCATION_OPTIONS.map(opt => {
              const active = location === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLocation(active ? '' : opt)}
                  className="px-4 py-2 rounded-xl border text-sm font-medium transition"
                  style={
                    active
                      ? { backgroundColor: `${ACCENT}18`, borderColor: ACCENT, color: ACCENT }
                      : {
                          backgroundColor: 'var(--bg-sidebar)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-tertiary)',
                        }
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* 연락처 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-tertiary mb-1.5 block">이름 *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="홍길동"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-tertiary mb-1.5 block">연락처 *</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              inputMode="tel"
              className={inputCls}
            />
          </div>
        </div>

        {/* 주소 */}
        <div>
          <label className="text-xs font-semibold text-tertiary mb-1.5 block">
            주소 <span className="font-normal text-dim">(선택)</span>
          </label>
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="서울시 강남구 테헤란로 123"
            className={inputCls}
          />
        </div>

        {/* 방문 희망일 */}
        <div>
          <label className="text-xs font-semibold text-tertiary mb-1.5 flex items-center gap-1.5">
            <Calendar size={13} className="text-dim" /> 방문 희망일 <span className="font-normal text-dim">(선택)</span>
          </label>
          <input
            type="date"
            value={preferredDate}
            onChange={e => setPreferredDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={inputCls}
          />
        </div>

        {/* 추가 요청 사항 */}
        <div>
          <label className="text-xs font-semibold text-tertiary mb-1.5 block">
            추가 요청 사항 <span className="font-normal text-dim">(선택)</span>
          </label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="설치 위치, 기존 에어컨 모델명, 특이사항 등을 자유롭게 입력해주세요"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base text-white transition disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> 신청 중...</>
          ) : (
            <><span>상담 신청하기</span><ChevronRight size={16} /></>
          )}
        </button>

        <p className="text-xs text-dim text-center">
          입력하신 정보는 상담 안내 목적으로만 사용됩니다
        </p>

        {/* 가격 안내 섹션 */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-4">
          <p className="text-sm font-bold text-primary">💰 가격 안내</p>
          <p className="text-xs text-muted">기본 작업비 기준이며 현장 상황에 따라 달라질 수 있습니다.</p>
          <div className="space-y-3">
            {(Object.entries(PRICE_GUIDE) as [ServiceType, { wall: string; stand: string }][]).map(([type, { wall, stand }]) => {
              const isSelected = serviceType === type;
              return (
                <div
                  key={type}
                  className="rounded-xl p-3 border transition"
                  style={
                    isSelected
                      ? { backgroundColor: `${ACCENT}10`, borderColor: `${ACCENT}40` }
                      : { backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }
                  }
                >
                  <p
                    className="text-xs font-bold mb-2"
                    style={{ color: isSelected ? ACCENT : 'var(--text-secondary)' }}
                  >
                    {type === '설치' ? '🔧' : type === '이전' ? '📦' : '🗑️'} 에어컨 {type}
                  </p>
                  <div className="flex justify-between text-xs text-tertiary">
                    <span>벽걸이형</span>
                    <span className="font-semibold text-primary">{wall}</span>
                  </div>
                  <div className="flex justify-between text-xs text-tertiary mt-1">
                    <span>스탠드형</span>
                    <span className="font-semibold text-primary">{stand}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-dim">
            ✅ 출장비 무료 &nbsp;·&nbsp; ✅ 당일 상담 가능 &nbsp;·&nbsp; ✅ 전국 서비스
          </p>
        </div>

      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-muted focus:outline-none transition';
