'use client';

import { useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useRouter } from 'next/navigation';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, Repeat, Repeat1, X, Megaphone,
} from 'lucide-react';

function fmtTime(sec: number) {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── 무드 색상 맵 (tracks page와 동일) ──
const MOOD_COLORS: Record<string, string> = {
  'lo-fi':'#6366f1','jazz':'#d97706','acoustic':'#78716c','cozy':'#f59e0b',
  'chill':'#06b6d4','upbeat':'#f43f5e','bright':'#facc15','pop':'#ec4899',
  'indie':'#8b5cf6','ambient':'#164e63','lounge':'#a16207','r&b':'#7c3aed',
  'tropical':'#10b981','morning-coffee':'#92400e','fresh':'#22d3ee','warm':'#ea580c',
  'night':'#1e1b4b','energetic':'#ef4444','EDM':'#a855f7','k-pop':'#f472b6',
  'study':'#475569','latin':'#dc2626','romantic':'#e11d48','hard rock':'#57534e',
  'synth-pop':'#c084fc','classical':'#854d0e',
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function getMoodColor(track: { mood_tags?: string[]; energy_score?: number | null; valence_score?: number | null; danceability_score?: number | null }, bass: number) {
  const genre = (track.mood_tags ?? [])[0] || '';
  const base = MOOD_COLORS[genre] || '#FF6F0F';
  const [r, g, b] = hexToRgb(base);
  const energy = (track.energy_score ?? 50) / 100;
  const valence = (track.valence_score ?? 50) / 100;
  const dance = (track.danceability_score ?? 50) / 100;

  // 무드벡터에 강하게 반응: 에너지→빨강 이동, 밸런스→밝기, 댄서블→채도
  const t = performance.now() / 1000;
  const shift = Math.sin(t * 1.5) * 0.5 + 0.5; // 0~1 cycle
  const rr = Math.round(r + (energy * 80 * bass) + (shift * dance * 40));
  const gg = Math.round(g + (valence * 60 * bass) - (energy * 20 * bass));
  const bb = Math.round(b + (dance * 50 * bass) + ((1 - shift) * valence * 30));
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return { r: clamp(rr), g: clamp(gg), b: clamp(bb) };
}

export default function BottomPlayer() {
  const router = useRouter();
  const {
    track, lastTrack, queue, queueIndex,
    isPlaying, currentTime, duration,
    volume, annVolume, shuffle, repeat, error,
    bassLevel, announcementPlaying,
    togglePlay, play, next, prev, seek, setVolume, setAnnVolume,
    toggleShuffle, toggleRepeat, close,
    crossfadeSec, setCrossfadeSec,
  } = usePlayer();

  // ── 재생 단축키 ────────────────────────────────────────────────
  useEffect(() => {
    const displayTrackInHandler = track ?? lastTrack;

    const triggerPlay = () => {
      if (track) togglePlay();
      else if (displayTrackInHandler) play(displayTrackInHandler); // 비활성 → 즉시 재생
    };

    const handler = (e: KeyboardEvent) => {
      // MediaPlayPause 키 — 입력 필드 무관하게 항상 허용
      if (e.code === 'MediaPlayPause') { e.preventDefault(); triggerPlay(); return; }

      if (!displayTrackInHandler) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      // A — Audio 재생/일시정지
      if (e.code === 'KeyA' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); triggerPlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [track, lastTrack, togglePlay, play]);

  // 표시할 트랙: 현재 재생 중 or 마지막 재생 트랙
  const displayTrack = track ?? lastTrack;
  if (!displayTrack) return null; // 한 번도 재생한 적 없으면 숨김

  const inactive = !track; // 재생 대기 상태
  const progress = duration > 0 ? currentTime / duration : 0;

  // 베이스 + 무드벡터 반응 스타일
  const bass = isPlaying ? bassLevel : 0;
  const mc = displayTrack && isPlaying ? getMoodColor(displayTrack, bass) : null;
  const borderTopColor = mc
    ? `rgba(${mc.r},${mc.g},${mc.b},${(0.3 + bass * 0.7).toFixed(2)})`
    : undefined;
  const topGlow = mc && bass > 0.2
    ? `inset 0 2px ${Math.round(bass * 24)}px rgba(${mc.r},${mc.g},${mc.b},${(bass * 0.4).toFixed(2)}), 0 -${Math.round(bass * 6)}px ${Math.round(bass * 16)}px rgba(${mc.r},${mc.g},${mc.b},${(bass * 0.2).toFixed(2)})`
    : undefined;

  return (
    <div
      style={{
        borderTopColor,
        borderTopWidth: isPlaying ? 2 : 1,
        boxShadow: topGlow,
        transition: 'border-color 80ms, box-shadow 80ms',
      }}
      className={`shrink-0 h-[72px] backdrop-blur-xl border-t flex items-center gap-4 z-40 ${
        inactive ? 'bg-surface/90' : 'bg-sidebar/95'
      }`}>

      {/* 사이드바 너비(w-56) 만큼 빈 공간 */}
      <div className="w-56 shrink-0" />

      {/* 플레이어 내용 */}
      <div className="flex-1 flex items-center gap-4 pr-4 min-w-0">

      {/* ── 왼쪽: 커버 + 곡 정보 (클릭 → 트랙 페이지) ── */}
      <div
        className={`flex items-center gap-3 w-[260px] shrink-0 cursor-pointer group/info ${inactive ? 'opacity-50' : ''}`}
        onClick={() => router.push(`/dashboard/tracks?hl=${displayTrack.id}`)}
        title="트랙 관리로 이동"
      >
        {/* 커버 */}
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-fill-subtle border border-border-subtle group-hover/info:border-accent flex items-center justify-center shrink-0 transition">
          {displayTrack.cover_image_url
            ? <img src={displayTrack.cover_image_url} alt={displayTrack.title} className="w-full h-full object-cover" />
            : <span className="text-xl">{displayTrack.cover_emoji ?? '🎵'}</span>
          }
        </div>
        {/* 제목/아티스트 */}
        <div className="min-w-0 flex-1">
          <p className="text-primary text-sm font-semibold truncate group-hover/info:text-accent transition">{displayTrack.title}</p>
          <p className="text-muted text-xs truncate">{displayTrack.artist}</p>
          {displayTrack.mood && (
            <p className="text-[#FF6F0F] text-[10px] font-semibold truncate">{displayTrack.mood}</p>
          )}
        </div>
      </div>

      {/* ── 중앙: 셔플 + 컨트롤 + 반복 + 시크바 ── */}
      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
        {/* 버튼 */}
        <div className="flex items-center gap-4">
          {/* 셔플 */}
          <button
            onClick={toggleShuffle}
            title={shuffle ? '셔플 켜짐' : '셔플 꺼짐'}
            className={`shrink-0 transition flex flex-col items-center gap-0.5 ${shuffle ? 'text-[#FF6F0F]' : 'text-dim hover:text-tertiary'}`}>
            <Shuffle size={14} />
            <span className="text-[8px] font-semibold leading-none">
              {shuffle ? '랜덤 On' : '랜덤 Off'}
            </span>
          </button>

          {/* Prev */}
          <button onClick={prev}
            disabled={queue.length <= 1}
            className="text-tertiary hover:text-primary transition disabled:opacity-30">
            <SkipBack size={18} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => inactive ? play(displayTrack) : togglePlay()}
            style={mc ? {
              backgroundColor: `rgb(${mc.r},${mc.g},${mc.b})`,
              boxShadow: bass > 0.3 ? `0 0 ${Math.round(bass * 14)}px rgba(${mc.r},${mc.g},${mc.b},0.5)` : undefined,
            } : {}}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-lg ${mc ? '' : 'bg-[#FF6F0F] hover:bg-[#FF6F0F]/90'}`}>
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

          {/* 반복 */}
          <button
            onClick={toggleRepeat}
            title={repeat === 'none' ? '반복 없음' : repeat === 'all' ? '전체 반복' : '1곡 반복'}
            className={`shrink-0 transition flex flex-col items-center gap-0.5 ${repeat !== 'none' ? 'text-[#FF6F0F]' : 'text-dim hover:text-tertiary'}`}>
            {repeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
            <span className="text-[8px] font-semibold leading-none">
              {repeat === 'none' ? '반복 Off' : repeat === 'all' ? '전체반복' : '1곡반복'}
            </span>
          </button>
        </div>

        {/* 에러 표시 */}
        {error && (
          <p className="text-[10px] text-red-400 font-semibold animate-pulse">❌ {error}</p>
        )}

        {/* 시크바 */}
        <div className={`flex items-center gap-2 w-full max-w-lg ${inactive ? 'opacity-50' : ''}`}>
          <span className="text-[10px] text-dim w-8 text-right shrink-0">{fmtTime(currentTime)}</span>
          <div className="relative flex-1 h-1 group">
            {/* 배경 트랙 */}
            <div className="absolute inset-0 bg-fill-medium rounded-full" />
            {/* 진행 */}
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: mc ? `rgb(${mc.r},${mc.g},${mc.b})` : '#FF6F0F',
                boxShadow: mc && bass > 0.3 ? `0 0 ${Math.round(bass * 8)}px rgba(${mc.r},${mc.g},${mc.b},0.6)` : 'none',
                transition: 'background-color 150ms, box-shadow 80ms',
              }}
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

      {/* ── 오른쪽: 큐 + 볼륨 + 닫기 ── */}
      <div className="flex items-center gap-2.5 w-[320px] shrink-0 justify-end">
        {/* 큐 정보 */}
        {queue.length > 1 && (
          <span className="text-[10px] text-dim hidden lg:block whitespace-nowrap">
            {queueIndex + 1} / {queue.length}
          </span>
        )}

        {/* 디졸브 시간 */}
        <div className="flex items-center gap-0.5" title="연속 재생 디졸브 시간">
          {([3, 4, 5] as const).map(s => (
            <button
              key={s}
              onClick={() => setCrossfadeSec(s)}
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition ${
                crossfadeSec === s
                  ? 'bg-[#FF6F0F]/80 text-white'
                  : 'text-dim hover:text-primary hover:bg-white/5'
              }`}
            >
              {s}초
            </button>
          ))}
        </div>

        {/* 구분선 */}
        <div className="w-px h-4 bg-border-subtle" />

        {/* 트랙 볼륨 */}
        <div className="flex items-center gap-1 group" title="트랙 볼륨">
          <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-muted hover:text-primary transition">
            {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <div className="relative w-14 h-1">
            <div className="absolute inset-0 bg-fill-medium rounded-full" />
            <div className="absolute top-0 left-0 h-full bg-tertiary rounded-full"
              style={{ width: `${volume * 100}%` }} />
            <input type="range" min={0} max={1} step={0.01} value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[9px] text-dim w-7 text-right">{Math.round(volume * 100)}%</span>
        </div>

        {/* 구분선 */}
        <div className="w-px h-4 bg-border-subtle" />

        {/* 안내방송 볼륨 */}
        <div className="flex items-center gap-1 group" title="안내방송 볼륨">
          <Megaphone size={12} className={`shrink-0 ${announcementPlaying ? 'text-[#FF6F0F] animate-pulse' : 'text-dim'}`} />
          <div className="relative w-14 h-1">
            <div className="absolute inset-0 bg-fill-medium rounded-full" />
            <div className="absolute top-0 left-0 h-full rounded-full bg-[#FF6F0F]"
              style={{ width: `${(annVolume / 2) * 100}%` }} />
            <input type="range" min={0} max={2} step={0.05} value={annVolume}
              onChange={e => setAnnVolume(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-[9px] w-7 text-right text-dim">
            {Math.round((annVolume / 2) * 100)}%
          </span>
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
