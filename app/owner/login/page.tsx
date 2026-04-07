'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Delete } from 'lucide-react';

const SESSION_HOURS = 8;

export default function OwnerLoginPage() {
  const router = useRouter();

  const [step, setStep]       = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone]     = useState('');
  const [pin, setPin]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('owner_session');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.exp > Date.now()) { router.replace('/owner/dashboard'); return; }
      }
    } catch {}
    phoneRef.current?.focus();
  }, [router]);

  // ── 전화번호 확인 ──
  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) { setError('올바른 전화번호를 입력해주세요.'); return; }
    setError('');
    setPhone(cleaned);
    setStep('pin');
  };

  // ── PIN 패드 ──
  const appendPin = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 6) verifyPin(next);
  };

  const deletePin = () => setPin(p => p.slice(0, -1));

  const verifyPin = async (p: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/owner/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin: p }),
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
  };

  const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6F0F] flex items-center justify-center text-2xl mb-3">🍖</div>
          <h1 className="text-xl font-bold text-white">언니픽 사장님 전용</h1>
          <p className="text-sm text-white/50 mt-1">사장님 대시보드에 오신 것을 환영합니다.</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">앱 가입 전화번호</label>
              <input
                ref={phoneRef}
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                placeholder="010-0000-0000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder:text-white/25 focus:outline-none focus:border-[#FF6F0F]/60"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#FF6F0F] text-white font-bold text-base hover:bg-[#e86200] transition"
            >
              다음
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-xs text-white/50 mb-1">
                <button onClick={() => { setStep('phone'); setPin(''); setError(''); }} className="underline hover:text-white/80 transition">{phone}</button>
              </p>
              <p className="text-sm text-white/70">6자리 PIN을 입력해주세요</p>
            </div>

            {/* PIN 표시 */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: 6 }, (_, i) => (
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

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

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
