'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function NowPlayingChip() {
  const { track, lastTrack, isPlaying } = usePlayer();
  const t = track ?? lastTrack;
  if (!t) return null;

  const tag = t.mood_tags?.[0];

  return (
    <div className="relative inline-flex items-center justify-center py-0.5">
      {/* NOW PLAYING — 중앙 영역 왼쪽 외부 */}
      {isPlaying && (
        <span className="absolute right-full mr-2 text-[10px] font-bold tracking-widest whitespace-nowrap text-accent animate-[nowplaying_1.8s_ease-in-out_infinite]">
          NOW PLAYING
        </span>
      )}
      {/* 제목 — 단독 중앙 */}
      <span className="text-primary text-2xl font-bold whitespace-nowrap tracking-tight drop-shadow-sm">
        {t.title}
      </span>
      {/* 장르 태그 — 중앙 영역 오른쪽 외부 */}
      {tag && (
        <span className="absolute left-full ml-2 text-[10px] px-1.5 py-0.5 rounded leading-none font-semibold whitespace-nowrap bg-accent/15 border border-accent/35 text-accent">
          {tag}
        </span>
      )}
    </div>
  );
}
