'use client';

import { useState, useMemo } from 'react';
import {
  Home, Package, Building2,
  MapPin, Calendar, FileText, Star,
  ChevronRight, Check, Loader2, BadgeCheck, Flame,
} from 'lucide-react';
import { DUMMY_COMPANIES, matchCompanies } from '@/lib/dummy-companies';

/* ------------------------------------------------------------------ */
/* Types & constants                                                    */
/* ------------------------------------------------------------------ */

type MovingType = 'household' | 'small' | 'office';

const TYPES: { key: MovingType; label: string; desc: string; icon: typeof Home }[] = [
  { key: 'household', label: '가정이사', desc: '아파트·빌라·단독주택', icon: Home },
  { key: 'small',     label: '소형이사', desc: '원룸·고시원·1인가구', icon: Package },
  { key: 'office',    label: '사무실이사', desc: '사무실·상가·매장', icon: Building2 },
];

const CHECKLIST: Record<MovingType, { label: string; category: string }[]> = {
  household: [
    { label: '냉장고', category: '가전' }, { label: '세탁기', category: '가전' },
    { label: 'TV', category: '가전' }, { label: '에어컨', category: '가전' },
    { label: '침대(싱글)', category: '침실' }, { label: '침대(더블/퀸)', category: '침실' },
    { label: '옷장', category: '침실' }, { label: '서랍장', category: '침실' },
    { label: '소파', category: '거실' }, { label: '식탁', category: '거실' },
    { label: '책상', category: '서재' }, { label: '책장', category: '서재' },
    { label: '피아노', category: '기타' }, { label: '자전거', category: '기타' },
  ],
  small: [
    { label: '침대', category: '침실' }, { label: '옷장', category: '침실' },
    { label: '서랍장', category: '침실' }, { label: 'TV', category: '가전' },
    { label: '냉장고(미니)', category: '가전' }, { label: '세탁기', category: '가전' },
    { label: '책상', category: '기타' }, { label: '의자', category: '기타' },
    { label: '박스(소) 1~5개', category: '박스' }, { label: '박스(중) 6~15개', category: '박스' },
    { label: '박스(대) 16개+', category: '박스' },
  ],
  office: [
    { label: '책상', category: '가구' }, { label: '의자', category: '가구' },
    { label: '캐비넷/서랍', category: '가구' }, { label: '회의실 테이블', category: '가구' },
    { label: '소파', category: '가구' }, { label: 'PC/서버', category: '장비' },
    { label: '모니터', category: '장비' }, { label: '복합기/프린터', category: '장비' },
    { label: '냉장고', category: '가전' }, { label: '커피머신', category: '가전' },
    { label: '박스 10개 미만', category: '박스' }, { label: '박스 10~30개', category: '박스' },
    { label: '박스 30개+', category: '박스' },
  ],
};

/* ------------------------------------------------------------------ */
/* Accent color mode: blue | red                                        */
/* ------------------------------------------------------------------ */

const ACCENT_COLORS = {
  blue: { main: '#3B82F6', light: '#3B82F622', text: 'text-blue-400' },
  red:  { main: '#EF4444', light: '#EF444422', text: 'text-red-400' },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const inputCls =
  'w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-muted focus:outline-none transition';

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={11}
          fill={s <= Math.round(rating) ? '#FBBF24' : 'none'}
          stroke={s <= Math.round(rating) ? '#FBBF24' : '#9ca3af'}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function MovingPage() {
  /* accent color toggle */
  const [accentKey, setAccentKey] = useState<'blue' | 'red'>('blue');
  const accent = ACCENT_COLORS[accentKey];

  /* form state */
  const [movingType, setMovingType] = useState<MovingType>('household');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [date, setDate]     = useState('');
  const [flexible, setFlexible] = useState(false);
  const [checked, setChecked]   = useState<Set<string>>(new Set());
  const [memo, setMemo]     = useState('');
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');

  /* submit state */
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState('');

  /* company list — updates live as user types destination */
  const companies = useMemo(() => matchCompanies(to, 10), [to]);

  const items = CHECKLIST[movingType];
  const categories = [...new Set(items.map(i => i.category))];

  const toggle = (label: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const isValid = from.trim() && to.trim() && (date || flexible) && name.trim() && phone.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/moving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: movingType,
          from_address: from.trim(),
          to_address: to.trim(),
          moving_date: flexible ? null : date,
          flexible_date: flexible,
          items: [...checked],
          memo: memo.trim() || null,
          user_name: name.trim(),
          user_phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출 실패');
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Done state ---- */
  if (done) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: accent.light }}
        >
          <Check size={36} style={{ color: accent.main }} />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-3">견적 신청 완료!</h1>
        <p className="text-tertiary text-sm leading-relaxed mb-6">
          매칭된 업체에서 영업일 1~2일 내에<br />연락드릴 예정입니다.
        </p>
        <button
          onClick={() => { setDone(false); setFrom(''); setTo(''); setDate(''); setChecked(new Set()); setMemo(''); setName(''); setPhone(''); setFlexible(false); }}
          className="px-6 py-3 rounded-xl text-sm font-bold text-white transition"
          style={{ backgroundColor: accent.main }}
        >
          새 견적 신청
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-[640px] space-y-5">

        {/* ---- 헤더 + 컬러 토글 ---- */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">이사 무료 견적</h1>
            <p className="text-sm text-muted mt-1">정보를 입력하면 지역 업체가 바로 매칭됩니다</p>
          </div>
          <button
            onClick={() => setAccentKey(k => k === 'blue' ? 'red' : 'blue')}
            className="shrink-0 mt-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition"
            style={{
              backgroundColor: accent.light,
              borderColor: accent.main,
              color: accent.main,
            }}
            title="컬러 모드 변경"
          >
            {accentKey === 'blue' ? '🔵 블루' : '🔴 레드'}
          </button>
        </div>

        {/* ---- 이사 유형 탭 ---- */}
        <div className="flex gap-2">
          {TYPES.map(({ key, label, icon: Icon }) => {
            const active = movingType === key;
            return (
              <button
                key={key}
                onClick={() => { setMovingType(key); setChecked(new Set()); }}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-xs font-bold transition"
                style={
                  active
                    ? { backgroundColor: accent.main, borderColor: accent.main, color: '#fff' }
                    : { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)', color: 'var(--text-tertiary)' }
                }
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ---- 출발지 / 도착지 ---- */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-4">
          <p className="text-xs font-semibold text-tertiary flex items-center gap-1.5">
            <MapPin size={13} className="text-dim" /> 주소
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted mb-1.5 block">출발지 *</label>
              <input
                value={from}
                onChange={e => setFrom(e.target.value)}
                placeholder="이사 출발 주소 (예: 서울시 강남구 역삼동)"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 block">도착지 *</label>
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="이사 도착 주소 (예: 경기도 성남시 분당구)"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ---- 이사 날짜 ---- */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-tertiary flex items-center gap-1.5">
            <Calendar size={13} className="text-dim" /> 이사 날짜
          </p>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            disabled={flexible}
            min={new Date().toISOString().split('T')[0]}
            className={`${inputCls} disabled:opacity-40`}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => { setFlexible(f => !f); if (!flexible) setDate(''); }}
              className="w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0"
              style={
                flexible
                  ? { backgroundColor: accent.main, borderColor: accent.main }
                  : { borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)' }
              }
            >
              {flexible && <Check size={12} color="#fff" strokeWidth={3} />}
            </div>
            <span className="text-sm text-tertiary">날짜 미정 (유연하게 조율 가능)</span>
          </label>
        </div>

        {/* ---- 짐 목록 체크리스트 ---- */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-4">
          <p className="text-xs font-semibold text-tertiary">짐 목록 (해당 항목 선택)</p>
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs text-dim mb-2">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {items.filter(i => i.category === cat).map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => toggle(item.label)}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium border transition"
                    style={
                      checked.has(item.label)
                        ? { backgroundColor: accent.main, borderColor: accent.main, color: '#fff' }
                        : { backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {checked.size > 0 && (
            <p className="text-xs text-muted">선택됨: {checked.size}개 항목</p>
          )}
        </div>

        {/* ---- 특이사항 ---- */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-tertiary flex items-center gap-1.5">
            <FileText size={13} className="text-dim" /> 특이사항
            <span className="font-normal text-dim">(선택)</span>
          </p>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="엘리베이터 없음, 피아노 있음, 특수 포장 필요 등 추가 안내사항을 입력하세요"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* ---- 연락처 ---- */}
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* ---- CTA ---- */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base text-white transition disabled:opacity-40"
          style={{ backgroundColor: accent.main }}
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> 신청 중...</>
          ) : (
            <><span>무료 견적 신청하기</span><ChevronRight size={16} /></>
          )}
        </button>

        <p className="text-xs text-dim text-center">
          입력하신 정보는 견적 안내 목적으로만 사용됩니다
        </p>

        {/* ================================================================ */}
        {/* ---- 업체 리스트 ---- */}
        {/* ================================================================ */}
        <div className="pt-4 border-t border-border-main">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-primary">
                {to.trim() ? `${to.trim().slice(0, 10)}${to.trim().length > 10 ? '…' : ''} 지역 업체` : '추천 이사 업체'}
              </h2>
              <p className="text-xs text-muted mt-0.5">도착지 입력 시 지역별 매칭</p>
            </div>
            <span className="text-xs text-dim">{companies.length}개 업체</span>
          </div>

          <div className="space-y-3">
            {companies.map(company => (
              <div
                key={company.id}
                className="bg-card border border-border-main rounded-2xl p-4 hover:bg-card-hover transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-primary">{company.name}</span>
                      {company.badge === '인기' && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                          style={{ backgroundColor: `${accent.main}22`, color: accent.main }}
                        >
                          <Flame size={9} /> 인기
                        </span>
                      )}
                      {company.badge === '인증' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-green-500/15 text-green-500">
                          <BadgeCheck size={9} /> 인증
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">{company.description}</p>

                    {/* 별점 + 리뷰 + 업력 */}
                    <div className="flex items-center gap-3 mt-2">
                      <StarRow rating={company.rating} />
                      <span className="text-xs font-semibold text-primary">{company.rating.toFixed(1)}</span>
                      <span className="text-xs text-muted">후기 {company.reviewCount.toLocaleString()}개</span>
                      <span className="text-xs text-dim">업력 {company.experience}년</span>
                    </div>

                    {/* 태그 */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {company.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-fill-subtle text-tertiary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 최소 견적 */}
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted">최소 견적</p>
                    <p className="text-base font-bold" style={{ color: accent.main }}>
                      {company.minPrice}만원~
                    </p>
                    <button
                      className="mt-2 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition"
                      style={{ backgroundColor: accent.main }}
                      onClick={handleSubmit}
                    >
                      견적요청
                    </button>
                  </div>
                </div>

                {/* 활동 지역 */}
                <div className="mt-3 pt-3 border-t border-border-main">
                  <p className="text-[10px] text-dim">
                    <span className="font-medium text-tertiary">활동지역</span>{' '}
                    {company.regions.slice(0, 5).join(' · ')}
                    {company.regions.length > 5 ? ' 외' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-dim text-center mt-4">
            더 많은 업체는 견적 신청 후 안내됩니다
          </p>
        </div>

      </div>
    </div>
  );
}
