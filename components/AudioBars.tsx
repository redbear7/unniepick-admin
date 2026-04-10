'use client';

import { usePlayer } from '@/contexts/PlayerContext';

// 고정값 — SSR/CSR 불일치 방지
const BARS = [
  { dur: 0.70, delay: 0.00 },
  { dur: 0.50, delay: 0.10 },
  { dur: 0.90, delay: 0.05 },
  { dur: 0.60, delay: 0.20 },
  { dur: 0.80, delay: 0.15 },
  { dur: 0.55, delay: 0.08 },
  { dur: 1.00, delay: 0.12 },
  { dur: 0.65, delay: 0.25 },
  { dur: 0.75, delay: 0.18 },
  { dur: 0.85, delay: 0.03 },
  { dur: 0.60, delay: 0.22 },
  { dur: 0.95, delay: 0.07 },
  { dur: 0.70, delay: 0.17 },
  { dur: 0.50, delay: 0.28 },
  { dur: 0.88, delay: 0.02 },
  { dur: 0.62, delay: 0.14 },
  { dur: 0.78, delay: 0.09 },
  { dur: 0.92, delay: 0.21 },
  { dur: 0.58, delay: 0.06 },
  { dur: 0.82, delay: 0.16 },
];

export default function AudioBars() {
  const { isPlaying } = usePlayer();

  return (
    <div
      className="w-full flex items-end gap-px shrink-0 overflow-hidden"
      style={{ height: 14 }}
    >
      <style>{`
        @keyframes audioBar {
          from { transform: scaleY(0.08); }
          to   { transform: scaleY(1.0);  }
        }
      `}</style>
      {BARS.map((b, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px] bg-accent origin-bottom"
          style={{
            height: '100%',
            transform: isPlaying ? undefined : 'scaleY(0.08)',
            animation: isPlaying
              ? `audioBar ${b.dur}s ${b.delay}s ease-in-out infinite alternate`
              : 'none',
            opacity: isPlaying ? 0.6 : 0.12,
            transition: isPlaying ? 'opacity 0.4s' : 'transform 0.4s ease, opacity 0.4s',
          }}
        />
      ))}
    </div>
  );
}
