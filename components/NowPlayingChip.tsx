'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function NowPlayingChip() {
  const { track, lastTrack, isPlaying } = usePlayer();
  const t = track ?? lastTrack;
  if (!t) return null;

  const tag = t.mood_tags?.[0];

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      {/* 재생 중 표시 */}
      {isPlaying && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
      )}
      {/* 장르 태그 */}
      {tag && (
        <span className="text-[10px] px-1.5 py-0.5 rounded leading-none font-semibold shrink-0 bg-accent/15 border border-accent/35 text-accent">
          {tag}
        </span>
      )}
      {/* 제목 */}
      <span className="text-primary text-xl font-bold whitespace-nowrap tracking-tight drop-shadow-sm">
        {t.title}
      </span>
    </div>
  );
}
