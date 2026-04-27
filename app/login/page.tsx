'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [pin,     setPin]     = useState(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Hooks 규칙: Array.from 안에서 useRef 호출 금지 → 개별 선언
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);
  const pinRefs = [ref0, ref1, ref2, ref3];

  const handlePinInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...pin];
    next[idx]   = digit;
    setPin(next);
    if (digit && idx < 3) {
      pinRefs[idx + 1].current?.focus();
    } else if (digit && idx === 3) {
      handleSubmit([...next]);
    }
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (pin[idx]) {
        const next = [...pin]; next[idx] = ''; setPin(next);
      } else if (idx > 0) {
        pinRefs[idx - 1].current?.focus();
      }
    }
  };

  const handleSubmit = async (pinArr = pin) => {
    const code = pinArr.join('');
    if (code.length < 4) return;

    setError('');
    setLoading(true);

    const res = await fetch('/api/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pin: code }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? '로그인 실패');
      setPin(['', '', '', '']);
      setLoading(false);
      // 429: 쿨다운 동안 입력 불가 표시
      if (res.status !== 429) {
        setTimeout(() => pinRefs[0].current?.focus(), 50);
      }
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-xs">

        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FF6F0F] mb-4">
            <span className="text-3xl">🍖</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">언니픽 슈퍼어드민</h1>
          <p className="text-sm text-muted mt-1">슈퍼어드민 전용</p>
        </div>

        {/* PIN 입력 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-tertiary">비밀번호 입력</p>
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              className="text-dim hover:text-tertiary transition"
            >
              {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <div className="flex gap-3 justify-center">
            {pin.map((v, idx) => (
              <input
                key={idx}
                ref={pinRefs[idx]}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={1}
                value={v}
                onChange={e => handlePinInput(idx, e.target.value)}
                onKeyDown={e => handlePinKeyDown(idx, e)}
                autoFocus={idx === 0}
                disabled={loading}
                className="w-14 h-14 bg-card border border-border-subtle rounded-2xl text-center text-2xl font-bold text-primary focus:outline-none focus:border-[#FF6F0F] disabled:opacity-40 transition caret-transparent"
              />
            ))}
          </div>

          {/* 에러 */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <p className="text-center text-sm text-muted mt-4">확인 중...</p>
          )}
        </div>

      </div>
    </div>
  );
}
