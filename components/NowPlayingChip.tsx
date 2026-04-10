'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function NowPlayingChip() {
  const { track, lastTrack, isPlaying } = usePlayer();
  const t = track ?? lastTrack;
  if (!t) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      {/* 재생 중 표시 */}
      {isPlaying && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
      )}
      {/* 제목 */}
      <span className="text-primary text-sm font-bold whitespace-nowrap tracking-tight">
        {t.title}
      </span>
    </div>
  );
}
