'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { LogOut, User, KeyRound, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';

interface OwnerSession {
  owner_pin_id: string;
  user_id:      string;
  name:         string;
  phone:        string;
  created_at:   string;
  exp:          number;
}

interface PinStatus {
  pin_changes:      number;
  pin_change_month: string;
}

const MAX_CHANGES = 2;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);

  // PIN 변경
  const [showPinChange, setShowPinChange] = useState(false);
  const [curPin, setCurPin]   = useState('');
  const [newPin, setNewPin]   = useState('');
  const [cfmPin, setCfmPin]   = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pinError, setPinError]   = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [changing, setChanging]   = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('owner_session');
      if (!raw) { router.replace('/owner/login'); return; }
      const s: OwnerSession = JSON.parse(raw);
      if (s.exp <= Date.now()) { localStorage.removeItem('owner_session'); router.replace('/owner/login'); return; }
      setSession(s);
      loadPinStatus(s.owner_pin_id);
    } catch {
      router.replace('/owner/login');
    }
  }, [router]);

  const loadPinStatus = async (id: string) => {
    const sb = createClient();
    const { data } = await sb
      .from('owner_pins')
      .select('pin_changes, pin_change_month')
      .eq('id', id)
      .single();
    if (data) setPinStatus(data as PinStatus);
  };

  const handleLogout = () => {
    localStorage.removeItem('owner_session');
    router.replace('/owner/login');
  };

  const remainingChanges = pinStatus
    ? pinStatus.pin_change_month === currentMonth()
      ? MAX_CHANGES - pinStatus.pin_changes
      : MAX_CHANGES
    : MAX_CHANGES;

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');
    if (!/^\d{6}$/.test(curPin)) { setPinError('현재 PIN은 6자리 숫자입니다.'); return; }
    if (!/^\d{6}$/.test(newPin)) { setPinError('새 PIN은 6자리 숫자입니다.'); return; }
    if (newPin !== cfmPin) { setPinError('새 PIN과 확인이 일치하지 않습니다.'); return; }

    setChanging(true);
    try {
      const res = await fetch('/api/owner/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_pin_id: session!.owner_pin_id,
          current_pin: curPin,
          new_pin: newPin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPinSuccess(`PIN이 변경되었습니다. 이번 달 남은 변경 횟수: ${data.remaining_changes}회`);
      setCurPin(''); setNewPin(''); setCfmPin('');
      setShowPinChange(false);
      if (session) loadPinStatus(session.owner_pin_id);
    } catch (e) {
      setPinError((e as Error).message);
    } finally {
      setChanging(false);
    }
  };

  if (!session) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#FF6F0F]" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF6F0F] flex items-center justify-center text-base">🍖</div>
          <div>
            <p className="text-xs text-white/40">언니픽</p>
            <p className="text-sm font-bold text-white">사장님 대시보드</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition"
        >
          <LogOut size={14} /> 로그아웃
        </button>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-5 py-8 space-y-5">

        {/* 환영 카드 */}
        <div className="bg-gradient-to-br from-[#FF6F0F]/20 to-[#FF6F0F]/5 border border-[#FF6F0F]/30 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#FF6F0F]/20 border border-[#FF6F0F]/40 flex items-center justify-center">
              <User size={24} className="text-[#FF6F0F]" />
            </div>
            <div>
              <p className="text-white/50 text-sm">안녕하세요</p>
              <p className="text-xl font-bold text-white mt-0.5">{session.name} 사장님</p>
            </div>
          </div>
        </div>

        {/* 계정 정보 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/70 mb-1">계정 정보</h2>
          {[
            { label: '이름',       value: session.name },
            { label: '전화번호',   value: session.phone },
            { label: '가입일',     value: new Date(session.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-xs text-white/40">{label}</span>
              <span className="text-sm text-white font-medium">{value}</span>
            </div>
          ))}
        </div>

        {/* PIN 관리 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <button
            onClick={() => { setShowPinChange(v => !v); setPinError(''); setPinSuccess(''); }}
            className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
                <KeyRound size={16} className="text-[#FF6F0F]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">PIN 변경</p>
                <p className="text-xs text-white/40 mt-0.5">
                  이번 달 남은 횟수: <span className={remainingChanges === 0 ? 'text-red-400' : 'text-[#FF9F4F]'}>{remainingChanges}회</span> / {MAX_CHANGES}회
                </p>
              </div>
            </div>
            <span className={`text-xs text-white/40 transition-transform ${showPinChange ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {showPinChange && (
            <div className="px-5 pb-5 border-t border-white/8">
              {pinSuccess ? (
                <div className="flex items-center gap-2 mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                  <p className="text-sm text-green-400">{pinSuccess}</p>
                </div>
              ) : remainingChanges === 0 ? (
                <p className="mt-4 text-sm text-red-400 text-center">
                  이번 달 PIN 변경 횟수를 모두 사용했습니다.<br />
                  <span className="text-white/40">다음 달 1일에 초기화됩니다.</span>
                </p>
              ) : (
                <form onSubmit={handleChangePin} className="mt-4 space-y-3">
                  {[
                    { label: '현재 PIN', value: curPin, set: setCurPin, show: showCur, toggle: () => setShowCur(v => !v) },
                    { label: '새 PIN',   value: newPin, set: setNewPin, show: showNew, toggle: () => setShowNew(v => !v) },
                    { label: '새 PIN 확인', value: cfmPin, set: setCfmPin, show: showNew, toggle: () => setShowNew(v => !v) },
                  ].map(({ label, value, set, show, toggle }) => (
                    <div key={label}>
                      <label className="block text-xs text-white/40 mb-1">{label}</label>
                      <div className="relative">
                        <input
                          type={show ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={6}
                          value={value}
                          onChange={e => { set(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-base tracking-widest placeholder:text-white/20 focus:outline-none focus:border-[#FF6F0F]/60 pr-10"
                          placeholder="••••••"
                        />
                        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition">
                          {show ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {pinError && <p className="text-sm text-red-400">{pinError}</p>}

                  <button
                    type="submit"
                    disabled={changing || curPin.length < 6 || newPin.length < 6 || cfmPin.length < 6}
                    className="w-full py-2.5 rounded-xl bg-[#FF6F0F] text-white font-bold text-sm hover:bg-[#e86200] transition disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {changing ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    PIN 변경하기
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
