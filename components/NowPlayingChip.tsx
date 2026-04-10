'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function NowPlayingChip() {
  const { track, lastTrack, isPlaying } = usePlayer();
  const t = track ?? lastTrack;
  if (!t) return null;

  const tag = t.mood_tags?.[0];

  return (
    <div className="relative flex items-center justify-center py-1 px-3">
      {/* 장르 태그 — 중앙 영역 왼쪽 외부 */}
      {tag && (
        <span className="absolute right-full mr-2 text-[10px] px-1.5 py-0.5 rounded leading-none font-semibold whitespace-nowrap bg-accent/15 border border-accent/35 text-accent">
          {tag}
        </span>
      )}
      {/* 제목 — 단독 중앙 */}
      <span className="text-primary text-xl font-bold whitespace-nowrap tracking-tight drop-shadow-sm">
        {t.title}
      </span>
      {/* 재생 중 표시 — 중앙 영역 오른쪽 외부 */}
      {isPlaying && (
        <span className="absolute left-full ml-2 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
      )}
    </div>
  );
}
