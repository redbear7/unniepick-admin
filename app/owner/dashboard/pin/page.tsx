'use client';

import { useState } from 'react';
import { useOwnerSession } from '@/components/OwnerShell';
import { KeyRound, Delete, CheckCircle2, AlertCircle } from 'lucide-react';

const MAX_CHANGES = 2;
const PIN_LENGTH = 4;

type Step = 'current' | 'new' | 'confirm';

const STEP_LABEL: Record<Step, string> = {
  current: '현재 PIN 입력',
  new:     '새 PIN 입력',
  confirm: '새 PIN 확인',
};

const STEP_DESC: Record<Step, string> = {
  current: '현재 사용 중인 4자리 PIN을 입력하세요.',
  new:     '새로운 4자리 PIN을 입력하세요.',
  confirm: '새 PIN을 한 번 더 입력하세요.',
};

function PinDots({ value, max = PIN_LENGTH }: { value: string; max?: number }) {
  return (
    <div className="flex items-center justify-center gap-3 my-6">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
            i < value.length
              ? 'bg-[#FF6F0F] scale-110'
              : 'bg-border-main'
          }`}
        />
      ))}
    </div>
  );
}

function Numpad({ onPress }: { onPress: (key: string) => void }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] mx-auto">
      {keys.map((k, i) => {
        if (k === '') return <div key={i} />;
        return (
          <button
            key={k}
            onClick={() => onPress(k)}
            className={`h-14 rounded-xl text-lg font-semibold transition active:scale-95 ${
              k === 'del'
                ? 'bg-card border border-border-main text-muted hover:text-primary hover:bg-border-main/50'
                : 'bg-card border border-border-main text-primary hover:bg-[#FF6F0F]/10 hover:border-[#FF6F0F]/40'
            }`}
          >
            {k === 'del' ? <Delete size={18} className="mx-auto" /> : k}
          </button>
        );
      })}
    </div>
  );
}

export default function OwnerPinPage() {
  const { session } = useOwnerSession();

  const [step, setStep]           = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [loading, setLoading]       = useState(false);

  if (!session) return null;

  // remaining changes calculation (client-side estimate from session's pinStatus — refreshed on mount via dashboard)
  // We just show the user the button is available; actual server checks on submit.

  const activePin = step === 'current' ? currentPin
    : step === 'new' ? newPin
    : confirmPin;

  const setActivePin = step === 'current' ? setCurrentPin
    : step === 'new' ? setNewPin
    : setConfirmPin;

  const handleNumpad = (key: string) => {
    setError('');
    if (key === 'del') {
      setActivePin(p => p.slice(0, -1));
      return;
    }
    if (activePin.length >= PIN_LENGTH) return;
    const next = activePin + key;
    setActivePin(next);

    if (next.length === PIN_LENGTH) {
      // auto-advance
      setTimeout(() => handleConfirm(next), 120);
    }
  };

  const handleConfirm = async (pin: string) => {
    if (step === 'current') {
      setStep('new');
      return;
    }
    if (step === 'new') {
      if (pin === currentPin) {
        setError('현재 PIN과 동일한 PIN으로 변경할 수 없습니다.');
        setNewPin('');
        return;
      }
      setStep('confirm');
      return;
    }
    // confirm step
    if (pin !== newPin) {
      setError('PIN이 일치하지 않습니다. 새 PIN부터 다시 입력하세요.');
      setNewPin('');
      setConfirmPin('');
      setStep('new');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/owner/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_pin_id: session.owner_pin_id,
          current_pin:  currentPin,
          new_pin:      newPin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'PIN 변경에 실패했습니다.');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setStep('current');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('current');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSuccess(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-border-main shrink-0">
        <h1 className="text-lg font-bold text-primary">PIN 관리</h1>
        <p className="text-xs text-muted mt-0.5">월 최대 {MAX_CHANGES}회 PIN을 변경할 수 있습니다.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
        <div className="w-full max-w-sm">
          {success ? (
            /* 성공 화면 */
            <div className="bg-card border border-border-main rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <div>
                <p className="text-base font-bold text-primary">PIN 변경 완료</p>
                <p className="text-sm text-muted mt-1">새 PIN이 성공적으로 설정되었습니다.</p>
              </div>
              <button
                onClick={handleReset}
                className="mt-2 px-6 py-2.5 rounded-xl bg-[#FF6F0F] text-white text-sm font-semibold hover:bg-[#e55e00] transition"
              >
                다시 변경하기
              </button>
            </div>
          ) : (
            /* PIN 입력 카드 */
            <div className="bg-card border border-border-main rounded-2xl p-6">
              {/* 단계 표시 */}
              <div className="flex items-center gap-2 mb-6">
                {(['current', 'new', 'confirm'] as Step[]).map((s, i) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                      s === step
                        ? 'bg-[#FF6F0F] text-white'
                        : step === 'new' && s === 'current' || step === 'confirm' && s !== 'confirm'
                          ? 'bg-[#FF6F0F]/20 text-[#FF6F0F]'
                          : 'bg-border-main text-muted'
                    }`}>
                      {i + 1}
                    </div>
                    {i < 2 && (
                      <div className={`flex-1 h-px transition-colors ${
                        (step === 'new' && i === 0) || step === 'confirm'
                          ? 'bg-[#FF6F0F]/40'
                          : 'bg-border-main'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* 아이콘 + 레이블 */}
              <div className="text-center mb-1">
                <div className="w-12 h-12 rounded-xl bg-[#FF6F0F]/10 flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={22} className="text-[#FF6F0F]" />
                </div>
                <p className="text-base font-bold text-primary">{STEP_LABEL[step]}</p>
                <p className="text-xs text-muted mt-1">{STEP_DESC[step]}</p>
              </div>

              {/* PIN 도트 */}
              <PinDots value={activePin} />

              {/* 에러 메시지 */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* 숫자 패드 */}
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[#FF6F0F] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <Numpad onPress={handleNumpad} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
