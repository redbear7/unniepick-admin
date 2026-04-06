'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, Repeat, Repeat1, X,
} from 'lucide-react';

function fmtTime(sec: number) {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function BottomPlayer() {
  const {
    track, lastTrack, queue, queueIndex,
    isPlaying, currentTime, duration,
    volume, shuffle, repeat,
    togglePlay, play, next, prev, seek, setVolume,
    toggleShuffle, toggleRepeat, close,
  } = usePlayer();

  // ── 스페이스바 단축키 ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!track) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [track, togglePlay]);

  // 표시할 트랙: 현재 재생 중 or 마지막 재생 트랙
  const displayTrack = track ?? lastTrack;
  if (!displayTrack) return null; // 한 번도 재생한 적 없으면 숨김

  const inactive = !track; // 재생 대기 상태
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={`shrink-0 h-[72px] backdrop-blur-xl border-t border-border-main flex items-center gap-4 z-40 transition-colors ${
      inactive ? 'bg-surface/90' : 'bg-sidebar/95'
    }`}>

      {/* 사이드바 너비(w-56) 만큼 빈 공간 */}
      <div className="w-56 shrink-0" />

      {/* 플레이어 내용 */}
      <div className="flex-1 flex items-center gap-4 pr-4 min-w-0">

      {/* ── 왼쪽: 커버 + 곡 정보 + 셔플 ── */}
      <div className={`flex items-center gap-3 w-[260px] shrink-0 ${inactive ? 'opacity-50' : ''}`}>
        {/* 커버 */}
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-fill-subtle border border-border-subtle flex items-center justify-center shrink-0">
          {displayTrack.cover_image_url
            ? <img src={displayTrack.cover_image_url} alt={displayTrack.title} className="w-full h-full object-cover" />
            : <span className="text-xl">{displayTrack.cover_emoji ?? '🎵'}</span>
          }
        </div>
        {/* 제목/아티스트 */}
        <div className="min-w-0 flex-1">
          <p className="text-primary text-sm font-semibold truncate">{displayTrack.title}</p>
          <p className="text-muted text-xs truncate">{displayTrack.artist}</p>
          {displayTrack.mood && (
            <p className="text-[#FF6F0F] text-[10px] font-semibold truncate">{displayTrack.mood}</p>
          )}
        </div>
        {/* 셔플 */}
        <button
          onClick={toggleShuffle}
          title={shuffle ? '셔플 켜짐' : '셔플 꺼짐'}
          className={`shrink-0 transition flex flex-col items-center gap-0.5 ${shuffle ? 'text-[#FF6F0F]' : 'text-dim hover:text-tertiary'}`}>
          <Shuffle size={15} />
          <span className="text-[8px] font-semibold leading-none">
            {shuffle ? '랜덤 On' : '랜덤 Off'}
          </span>
        </button>
      </div>

      {/* ── 중앙: 컨트롤 + 시크바 ── */}
      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
        {/* 버튼 */}
        <div className="flex items-center gap-3">
          {/* Prev */}
          <button onClick={prev}
            disabled={queue.length <= 1}
            className="text-tertiary hover:text-primary transition disabled:opacity-30">
            <SkipBack size={18} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => inactive ? play(displayTrack) : togglePlay()}
            className="w-9 h-9 rounded-full bg-[#FF6F0F] flex items-center justify-center hover:bg-[#FF6F0F]/90 transition shadow-lg">
            {isPlaying
              ? <Pause size={15} className="text-white" />
              : <Play  size={15} className="text-white ml-0.5" />
            }
          </button>

          {/* Next */}
          <button onClick={next}
            disabled={queue.length <= 1}
            className="text-tertiary hover:text-primary transition disabled:opacity-30">
            <SkipForward size={18} />
          </button>
        </div>

        {/* 대기 상태 안내 */}
        {inactive && (
          <p className="text-[10px] text-dim">▶ 눌러서 마지막 재생 트랙 시작</p>
        )}

        {/* 시크바 */}
        <div className={`flex items-center gap-2 w-full max-w-lg ${inactive ? 'opacity-30 pointer-events-none' : ''}`}>
          <span className="text-[10px] text-dim w-8 text-right shrink-0">{fmtTime(currentTime)}</span>
          <div className="relative flex-1 h-1 group">
            {/* 배경 트랙 */}
            <div className="absolute inset-0 bg-fill-medium rounded-full" />
            {/* 진행 */}
            <div
              className="absolute top-0 left-0 h-full bg-[#FF6F0F] rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
            {/* 핸들 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#FF6F0F] rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress * 100}% - 6px)` }}
            />
            {/* 클릭 감지 */}
            <input
              type="range" min={0} max={duration || 1} step={0.1}
              value={currentTime}
              onChange={e => seek(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-[10px] text-dim w-8 shrink-0">{fmtTime(duration)}</span>
        </div>
      </div>

      {/* ── 오른쪽: 반복 + 큐 + 볼륨 + 닫기 ── */}
      <div className="flex items-center gap-3 w-[220px] shrink-0 justify-end">
        {/* 반복 */}
        <button
          onClick={toggleRepeat}
          title={repeat === 'none' ? '반복 없음' : repeat === 'all' ? '전체 반복' : '1곡 반복'}
          className={`shrink-0 transition flex flex-col items-center gap-0.5 ${repeat !== 'none' ? 'text-[#FF6F0F]' : 'text-dim hover:text-tertiary'}`}>
          {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          <span className="text-[8px] font-semibold leading-none">
            {repeat === 'none' ? '반복 Off' : repeat === 'all' ? '전체반복' : '1곡반복'}
          </span>
        </button>

        {/* 큐 정보 */}
        {queue.length > 1 && (
          <span className="text-[10px] text-dim hidden lg:block whitespace-nowrap">
            {queueIndex + 1} / {queue.length}
          </span>
        )}

        {/* 볼륨 */}
        <div className="flex items-center gap-1.5 group">
          <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-muted hover:text-primary transition">
            {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <div className="relative w-16 h-1">
            <div className="absolute inset-0 bg-fill-medium rounded-full" />
            <div
              className="absolute top-0 left-0 h-full bg-tertiary rounded-full"
              style={{ width: `${volume * 100}%` }}
            />
            <input
              type="range" min={0} max={1} step={0.01}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* 닫기 */}
        <button onClick={close}
          className="text-dim hover:text-secondary transition ml-1">
          <X size={14} />
        </button>
      </div>

      </div>{/* end 플레이어 내용 */}
    </div>
  );
}
