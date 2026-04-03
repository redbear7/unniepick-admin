'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';

const CORRECT_PIN = '1111';

export default function PinPage() {
  const router  = useRouter();
  const [pin,     setPin]     = useState(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const pinRefs = Array.from({ length: 4 }, () => useRef<HTMLInputElement>(null));

  const handlePinInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...pin];
    next[idx]   = digit;
    setPin(next);
    if (digit && idx < 3) pinRefs[idx + 1].current?.focus();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = pin.join('');
    if (code.length < 4) {
      setError('4자리를 모두 입력해주세요');
      return;
    }
    if (code !== CORRECT_PIN) {
      setError('2차 비밀번호가 올바르지 않아요');
      setPin(['', '', '', '']);
      pinRefs[0].current?.focus();
      return;
    }

    setLoading(true);

    // 세션 확인
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0D0F14] flex items-center justify-center p-4">
      <div className="w-full max-w-xs">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FF6F0F] mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-xl font-bold text-white">2차 인증</h1>
          <p className="text-sm text-gray-500 mt-1">4자리 비밀번호를 입력해주세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400">2차 비밀번호</label>
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="text-gray-600 hover:text-gray-400 transition"
              >
                {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
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
                  className="w-12 h-12 bg-[#1A1D23] border border-white/10 rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:border-[#FF6F0F] transition caret-transparent"
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pin.join('').length < 4}
            className="w-full bg-[#FF6F0F] hover:bg-[#e05f00] disabled:opacity-40 text-white font-bold rounded-xl py-3 text-sm transition"
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </form>

      </div>
    </div>
  );
}
