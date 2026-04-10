'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, MapPin, Calendar, FileText, ChevronRight } from 'lucide-react';

export type MovingType = 'household' | 'small' | 'office';

const TYPE_LABELS: Record<MovingType, string> = {
  household: '가정이사',
  small: '소형이사',
  office: '사무실이사',
};

const TYPE_COLORS: Record<MovingType, string> = {
  household: '#FF6F0F',
  small: '#3B82F6',
  office: '#8B5CF6',
};

const CHECKLIST_ITEMS: Record<MovingType, { label: string; category: string }[]> = {
  household: [
    { label: '냉장고', category: '가전' },
    { label: '세탁기', category: '가전' },
    { label: 'TV', category: '가전' },
    { label: '에어컨', category: '가전' },
    { label: '침대(싱글)', category: '침실' },
    { label: '침대(더블/퀸)', category: '침실' },
    { label: '옷장', category: '침실' },
    { label: '서랍장', category: '침실' },
    { label: '소파', category: '거실' },
    { label: '식탁', category: '거실' },
    { label: '책상', category: '서재' },
    { label: '책장', category: '서재' },
    { label: '피아노', category: '기타' },
    { label: '자전거', category: '기타' },
  ],
  small: [
    { label: '침대', category: '침실' },
    { label: '옷장', category: '침실' },
    { label: '서랍장', category: '침실' },
    { label: 'TV', category: '가전' },
    { label: '냉장고(미니)', category: '가전' },
    { label: '세탁기', category: '가전' },
    { label: '책상', category: '기타' },
    { label: '의자', category: '기타' },
    { label: '박스(소) 1~5개', category: '박스' },
    { label: '박스(중) 6~15개', category: '박스' },
    { label: '박스(대) 16개+', category: '박스' },
  ],
  office: [
    { label: '책상', category: '가구' },
    { label: '의자', category: '가구' },
    { label: '캐비넷/서랍', category: '가구' },
    { label: '회의실 테이블', category: '가구' },
    { label: '소파', category: '가구' },
    { label: 'PC/서버', category: '장비' },
    { label: '모니터', category: '장비' },
    { label: '복합기/프린터', category: '장비' },
    { label: '냉장고', category: '가전' },
    { label: '커피머신', category: '가전' },
    { label: '박스 10개 미만', category: '박스' },
    { label: '박스 10~30개', category: '박스' },
    { label: '박스 30개+', category: '박스' },
  ],
};

interface Props {
  type: MovingType;
}

export default function MovingEstimateForm({ type }: Props) {
  const router = useRouter();
  const color = TYPE_COLORS[type];
  const label = TYPE_LABELS[type];

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [flexible, setFlexible] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [memo, setMemo] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const items = CHECKLIST_ITEMS[type];
  const categories = [...new Set(items.map(i => i.category))];

  const toggle = (label: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const isValid = from.trim() && to.trim() && (date || flexible) && name.trim() && phone.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const itemsText = checked.size > 0 ? `[짐 목록] ${[...checked].join(', ')}` : '';
      const memoText = memo.trim() ? `[특이사항] ${memo.trim()}` : '';
      const flexText = flexible ? '[날짜 미정 - 협의 가능]' : '';
      const contentParts = [`[이사 유형] ${label}`, itemsText, memoText, flexText].filter(Boolean);

      const res = await fetch('/api/moving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          from_address: from.trim(),
          to_address: to.trim(),
          moving_date: flexible ? null : date,
          content: contentParts.join('\n'),
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
          style={{ backgroundColor: `${color}22` }}
        >
          <Check size={36} style={{ color }} />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-3">견적 신청 완료!</h1>
        <p className="text-tertiary text-sm leading-relaxed mb-8">
          {label} 무료 견적 신청이 접수되었습니다.<br />
          영업일 1~2일 내에 연락드릴게요.
        </p>
        <button
          onClick={() => router.push('/moving')}
          className="text-sm font-semibold text-muted hover:text-tertiary transition underline underline-offset-2"
        >
          처음으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-lg space-y-5">

        {/* 헤더 */}
        <div className="text-center mb-2">
          <span
            className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {label}
          </span>
          <h1 className="text-2xl font-bold text-primary">무료 이사 견적 신청</h1>
          <p className="text-sm text-muted mt-1">정보를 입력하시면 맞춤 견적을 보내드립니다</p>
        </div>

        {/* 이사 유형 변경 */}
        <div className="flex gap-2 justify-center flex-wrap">
          {(Object.keys(TYPE_LABELS) as MovingType[]).map(t => (
            <button
              key={t}
              onClick={() => router.push(`/moving/${t}`)}
              className="px-4 py-2 rounded-xl text-sm font-semibold border transition"
              style={
                t === type
                  ? { backgroundColor: color, borderColor: color, color: '#fff' }
                  : {
                      backgroundColor: 'var(--bg-sidebar)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-tertiary)',
                    }
              }
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* 출발지 / 도착지 */}
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

        {/* 이사 날짜 */}
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
              className="w-5 h-5 rounded-md border flex items-center justify-center transition"
              style={
                flexible
                  ? { backgroundColor: color, borderColor: color }
                  : { borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)' }
              }
            >
              {flexible && <Check size={12} color="#fff" strokeWidth={3} />}
            </div>
            <span className="text-sm text-tertiary">날짜 미정 (유연하게 조율 가능)</span>
          </label>
        </div>

        {/* 짐 목록 체크리스트 */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-4">
          <p className="text-xs font-semibold text-tertiary">짐 목록 (해당되는 항목 선택)</p>
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
                        ? { backgroundColor: color, borderColor: color, color: '#fff' }
                        : {
                            backgroundColor: 'var(--bg-sidebar)',
                            borderColor: 'var(--border-subtle)',
                            color: 'var(--text-tertiary)',
                          }
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

        {/* 특이사항 */}
        <div className="bg-card border border-border-main rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-tertiary flex items-center gap-1.5">
            <FileText size={13} className="text-dim" /> 특이사항 <span className="font-normal text-dim">(선택)</span>
          </p>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="엘리베이터 없음, 피아노 있음, 특수 포장 필요 등 추가 안내사항을 입력하세요"
            rows={3}
            className={`${inputCls} resize-none`}
          />
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base text-white transition disabled:opacity-40"
          style={{ backgroundColor: color }}
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
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-sidebar border border-border-subtle rounded-xl px-4 py-3 text-sm text-primary placeholder-muted focus:outline-none transition';
