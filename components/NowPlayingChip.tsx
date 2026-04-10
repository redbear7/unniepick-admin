'use client';

import { usePlayer } from '@/contexts/PlayerContext';

interface Props {
  onTagClick?: (tag: string) => void;
}

export default function NowPlayingChip({ onTagClick }: Props) {
  const { track, lastTrack, isPlaying } = usePlayer();
  const t = track ?? lastTrack;
  if (!t) return null;

  const tag = t.mood_tags?.[0];

  return (
    <div className="relative inline-flex items-center justify-center py-0.5">
      {/* 장르 태그 — 왼쪽 외부, 제목과 수직 중앙 정렬 */}
      {tag && (
        <span
          onClick={() => onTagClick?.(tag)}
          className={`absolute right-full top-1/2 -translate-y-1/2 mr-2 text-[10px] px-1.5 py-0.5 rounded leading-none font-semibold whitespace-nowrap bg-accent/15 border border-accent/35 text-accent ${isPlaying ? 'animate-[nowplaying_1.8s_ease-in-out_infinite]' : ''} ${onTagClick ? 'cursor-pointer hover:bg-accent/30 transition-colors' : ''}`}
        >
          {tag}
        </span>
      )}
      {/* 제목 — 단독 중앙 */}
      <span className="text-primary text-2xl font-bold whitespace-nowrap tracking-tight drop-shadow-sm">
        {t.title}
      </span>
    </div>
  );
}
