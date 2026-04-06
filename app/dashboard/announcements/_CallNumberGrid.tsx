'use client';

import { Loader2 } from 'lucide-react';
import { CALL_CARD_COUNT } from './_shared';

interface Props {
  callStartNum:   string;
  callingNum:     number | null;
  lastCalledNum:  number | null;
  size:           'small' | 'large';
  isCached:       (n: number) => boolean;
  onCallNum:      (n: number) => void;
}

export default function CallNumberGrid({
  callStartNum, callingNum, lastCalledNum,
  size, isCached, onCallNum,
}: Props) {
  if (!callStartNum || isNaN(Number(callStartNum))) return null;

  const nums = Array.from({ length: CALL_CARD_COUNT }, (_, i) => Number(callStartNum) + i);
  const isSmall = size === 'small';

  return (
    <div className={isSmall ? 'grid grid-cols-5 gap-1.5' : 'grid grid-cols-4 gap-3 max-w-3xl mx-auto'}>
      {nums.map(n => {
        const isCalling    = callingNum === n;
        const isLastCalled = lastCalledNum === n && callingNum !== n;
        const cached       = isCached(n);
        return (
          <button
            key={n}
            onClick={() => onCallNum(n)}
            disabled={callingNum !== null}
            className={`relative flex flex-col items-center justify-center ${isSmall ? 'py-2.5 rounded-xl border' : 'py-8 rounded-2xl border-2'} ${isSmall ? 'font-bold' : 'font-black'} transition select-none ${
              isCalling
                ? isSmall
                  ? 'bg-[#FF6F0F]/20 border-[#FF6F0F]/60 text-[#FF6F0F]'
                  : 'bg-[#FF6F0F]/25 border-[#FF6F0F] text-[#FF6F0F] scale-95'
                : isLastCalled
                  ? isSmall
                    ? 'bg-white/20 border-white/60 text-primary shadow-sm'
                    : 'bg-white/25 border-white text-primary shadow-lg shadow-white/10'
                  : cached
                    ? isSmall
                      ? 'bg-teal-500/10 border-teal-500/30 text-teal-300 hover:bg-teal-500/20'
                      : 'bg-teal-500/15 border-teal-400/50 text-teal-200 hover:bg-teal-500/25 hover:border-teal-300'
                    : isSmall
                      ? 'bg-white/[0.03] border-border-subtle text-secondary hover:bg-white/[0.06] hover:border-border-main'
                      : 'bg-white/[0.04] border-white/15 text-gray-200 hover:bg-fill-medium hover:border-white/35 hover:text-primary'
            } disabled:cursor-not-allowed ${!isSmall ? 'active:scale-95' : ''}`}
          >
            {isCalling
              ? <Loader2 size={isSmall ? 12 : 32} className="animate-spin" />
              : <span className={isSmall ? 'text-xs' : 'text-4xl'}>{n}</span>
            }
            {isLastCalled && !isSmall && (
              <span className="text-[11px] font-semibold text-primary/70 mt-1">마지막 호출</span>
            )}
            {cached && !isCalling && !isLastCalled && (
              <span className={`absolute ${isSmall ? 'top-0.5 right-0.5 w-1.5 h-1.5' : 'top-2 right-2 w-2 h-2'} rounded-full bg-teal-400`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
