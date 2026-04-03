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
    track, queue, queueIndex,
    isPlaying, currentTime, duration,
    volume, shuffle, repeat,
    togglePlay, next, prev, seek, setVolume,
    toggleShuffle, toggleRepeat, close,
  } = usePlayer();

  // ── 스페이스바 단축키 ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!track) return;
      // input/textarea/contenteditable 에서는 무시
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [track, togglePlay]);

  if (!track) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="shrink-0 h-[72px] bg-[#111318]/95 backdrop-blur-xl border-t border-white/[0.06] flex items-center gap-4 z-40">

      {/* 사이드바 너비(w-56) 만큼 빈 공간 — 플레이어는 메인 컨텐츠 영역부터 시작 */}
      <div className="w-56 shrink-0" />

      {/* 플레이어 내용 — 사이드바 오른쪽 경계에서 시작 */}
      <div className="flex-1 flex items-center gap-4 pr-4 min-w-0">

      {/* ── 왼쪽: 커버 + 곡 정보 + 셔플 ── */}
      <div className="flex items-center gap-3 w-[260px] shrink-0">
        {/* 커버 */}
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          {track.cover_image_url
            ? <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover" />
            : <span className="text-xl">{track.cover_emoji ?? '🎵'}</span>
          }
        </div>
        {/* 제목/아티스트 */}
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-semibold truncate">{track.title}</p>
          <p className="text-gray-500 text-xs truncate">{track.artist}</p>
          {track.mood && (
            <p className="text-[#FF6F0F] text-[10px] font-semibold truncate">{track.mood}</p>
          )}
        </div>
        {/* 셔플 */}
        <button
          onClick={toggleShuffle}
          title={shuffle ? '셔플 켜짐' : '셔플 꺼짐'}
          className={`shrink-0 transition relative ${shuffle ? 'text-[#FF6F0F]' : 'text-gray-600 hover:text-gray-400'}`}>
          <Shuffle size={15} />
          {shuffle && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF6F0F]" />
          )}
        </button>
      </div>

      {/* ── 중앙: 컨트롤 + 시크바 ── */}
      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
        {/* 버튼 */}
        <div className="flex items-center gap-3">
          {/* Prev */}
          <button onClick={prev}
            disabled={queue.length <= 1}
            className="text-gray-400 hover:text-white transition disabled:opacity-30">
            <SkipBack size={18} />
          </button>

          {/* Play / Pause */}
          <button onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-white/90 transition shadow-lg">
            {isPlaying
              ? <Pause size={15} className="text-[#0D0F14]" />
              : <Play  size={15} className="text-[#0D0F14] ml-0.5" />
            }
          </button>

          {/* Next */}
          <button onClick={next}
            disabled={queue.length <= 1}
            className="text-gray-400 hover:text-white transition disabled:opacity-30">
            <SkipForward size={18} />
          </button>
        </div>

        {/* 시크바 */}
        <div className="flex items-center gap-2 w-full max-w-lg">
          <span className="text-[10px] text-gray-600 w-8 text-right shrink-0">{fmtTime(currentTime)}</span>
          <div className="relative flex-1 h-1 group">
            {/* 배경 트랙 */}
            <div className="absolute inset-0 bg-white/10 rounded-full" />
            {/* 진행 */}
            <div
              className="absolute top-0 left-0 h-full bg-[#FF6F0F] rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
            {/* 핸들 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
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
          <span className="text-[10px] text-gray-600 w-8 shrink-0">{fmtTime(duration)}</span>
        </div>
      </div>

      {/* ── 오른쪽: 반복 + 큐 + 볼륨 + 닫기 ── */}
      <div className="flex items-center gap-3 w-[220px] shrink-0 justify-end">
        {/* 반복 */}
        <button
          onClick={toggleRepeat}
          title={repeat === 'none' ? '반복 없음' : repeat === 'all' ? '전체 반복' : '1곡 반복'}
          className={`shrink-0 transition relative ${repeat !== 'none' ? 'text-[#FF6F0F]' : 'text-gray-600 hover:text-gray-400'}`}>
          {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          {repeat !== 'none' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF6F0F]" />
          )}
        </button>

        {/* 큐 정보 */}
        {queue.length > 1 && (
          <span className="text-[10px] text-gray-600 hidden lg:block whitespace-nowrap">
            {queueIndex + 1} / {queue.length}
          </span>
        )}

        {/* 볼륨 */}
        <div className="flex items-center gap-1.5 group">
          <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-gray-500 hover:text-white transition">
            {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <div className="relative w-16 h-1">
            <div className="absolute inset-0 bg-white/10 rounded-full" />
            <div
              className="absolute top-0 left-0 h-full bg-white/40 rounded-full"
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
          className="text-gray-600 hover:text-gray-300 transition ml-1">
          <X size={14} />
        </button>
      </div>

      </div>{/* end 플레이어 내용 */}
    </div>
  );
}
