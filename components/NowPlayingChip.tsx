'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function NowPlayingChip() {
  const { track, lastTrack, isPlaying } = usePlayer();
  const t = track ?? lastTrack;
  if (!t) return null;

  const tags = (t.mood_tags ?? []).slice(0, 3);

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-0.5">
        {/* 썸네일 */}
        <div className="w-7 h-7 rounded-md overflow-hidden bg-fill-subtle border border-border-subtle shrink-0">
          {t.cover_image_url
            ? <img src={t.cover_image_url} alt={t.title} className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-sm leading-none">{t.cover_emoji ?? '🎵'}</span>
          }
        </div>

        {/* 장르 태그 */}
        {tags.map((tag, i) => (
          <span
            key={tag}
            className={`text-[9px] px-1.5 py-0.5 rounded leading-none font-semibold shrink-0 border ${
              i === 0
                ? 'bg-accent/15 border-accent/35 text-accent'
                : 'bg-fill-subtle border-border-subtle text-muted'
            }`}
          >
            {tag}
          </span>
        ))}

        {/* 제목 */}
        <span className="text-primary text-[11px] font-semibold whitespace-nowrap">
          {t.title}
        </span>

        {/* 재생 중 표시 */}
        {isPlaying && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
        )}
      </div>
      <div className="w-px h-4 bg-border-main shrink-0" />
    </>
  );
}
