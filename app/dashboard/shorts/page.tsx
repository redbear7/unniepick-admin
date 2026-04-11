'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { createClient } from '@/lib/supabase';
import { usePlayer } from '@/contexts/PlayerContext';
import { useSearchParams } from 'next/navigation';
import {
  Film,
  Search,
  Loader2,
  Zap,
  Download,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Trash2,
  Share2,
  Copy,
  Check,
  ImageIcon,
  RotateCcw,
  Maximize2,
  X,
  Heart,
} from 'lucide-react';

// ─── 타입 ──────────────────────────────────────────────────────
interface Coupon {
  id: string;
  title: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  expires_at: string | null;
}

interface AnnItem {
  id: string;
  text: string;
  audio_url: string;
  voice_type: string;
  created_at: string;
}

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  cover_image_url: string | null;
  cover_emoji: string;
  duration_sec: number;
  bpm: number | null;
  energy_level: 'low' | 'medium' | 'high' | null;
  mood: string | null;
  mood_tags: string[];
  energy_score?: number | null;
}

// ─── 헬퍼 ──────────────────────────────────────────────────────
function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── 숏폼 히스토리 (로컬 저장) ──────────────────────────────────
interface ShortsHistoryItem {
  id: string;
  trackId: string;
  trackTitle: string;
  artist: string;
  coverUrl: string | null;
  coverEmoji: string;
  videoUrl: string;
  startSec: number;
  moodTags: string[];
  createdAt: string;
  storeName?: string;
  // 재생성을 위한 설정 스냅샷
  waveformStyle?: 'bar' | 'mirror' | 'wave' | 'circle' | 'dots';
  durationSec?: number;
  shortsTitle?: string;
  shortsTagline?: string;
  audioFadeInSec?: number;
  likeCount?: number;
}

const SHORTS_HISTORY_KEY = 'shorts_render_history';
const SHORTS_HISTORY_MAX = 30;

function loadShortsHistory(): ShortsHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(SHORTS_HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveShortsHistory(list: ShortsHistoryItem[]) {
  try { localStorage.setItem(SHORTS_HISTORY_KEY, JSON.stringify(list.slice(0, SHORTS_HISTORY_MAX))); } catch {}
}
function pushShortsHistory(item: ShortsHistoryItem) {
  saveShortsHistory([item, ...loadShortsHistory()]);
}
function removeShortsHistory(id: string) {
  saveShortsHistory(loadShortsHistory().filter(h => h.id !== id));
}

// ─── 웨이브폼 에디터 ──────────────────────────────────────────────
function WaveformEditor({
  audioUrl,
  durationSec,
  startSec,
  windowSec,
  onStartChange,
  onPlayStart,
  autoPlayOnSelect = false,
  stopToken = 0,
}: {
  audioUrl: string;
  durationSec: number;
  startSec: number;
  windowSec: number;
  onStartChange: (s: number) => void;
  onPlayStart?: () => void;
  autoPlayOnSelect?: boolean;
  stopToken?: number;
}) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const animFrameRef   = useRef<number>(0);
  const dragging       = useRef(false);
  const lastSec        = useRef(0);
  const userDraggedRef = useRef(false); // 사용자가 직접 구간을 이동했는지

  const [peaks,   setPeaks]   = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0); // 0~1 within window

  // ── Decode audio → peaks ──
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    setLoading(true);
    setPeaks([]);

    (async () => {
      try {
        const res  = await fetch(audioUrl);
        const buf  = await res.arrayBuffer();
        if (cancelled) return;
        const AC   = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac   = new AC();
        const decoded = await ac.decodeAudioData(buf);
        await ac.close();
        if (cancelled) return;

        const raw = decoded.getChannelData(0);
        const N   = 600;
        const blk = Math.floor(raw.length / N);
        const out: number[] = [];
        for (let i = 0; i < N; i++) {
          let mx = 0;
          const base = i * blk;
          for (let j = 0; j < blk; j++) { const v = Math.abs(raw[base + j] ?? 0); if (v > mx) mx = v; }
          out.push(mx);
        }
        if (!cancelled) setPeaks(out);
      } catch { /* silent — no waveform */ }
      finally   { if (!cancelled) setLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [audioUrl]);

  // ── Draw ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || 400;
    const H   = canvas.offsetHeight || 96;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const midY = H / 2;

    ctx.fillStyle = '#0a0c14';
    ctx.fillRect(0, 0, W, H);

    const selX  = (startSec / durationSec) * W;
    const selWx = (Math.min(windowSec, durationSec - startSec) / durationSec) * W;

    // selection bg
    ctx.fillStyle = 'rgba(255,111,15,0.10)';
    ctx.fillRect(selX, 0, selWx, H);

    if (peaks.length > 0) {
      const bw = W / peaks.length;
      peaks.forEach((p, i) => {
        const x    = i * bw;
        const h    = Math.max(p * H * 0.82, 1);
        const inSel = x + bw > selX && x < selX + selWx;
        // main bar
        ctx.fillStyle = inSel ? '#FF6F0F' : '#252838';
        ctx.fillRect(x + 0.5, midY - h / 2, Math.max(bw - 0.8, 0.5), h);
        // reflection
        ctx.fillStyle = inSel ? 'rgba(255,111,15,0.3)' : 'rgba(37,40,56,0.5)';
        ctx.fillRect(x + 0.5, midY + h / 2, Math.max(bw - 0.8, 0.5), h * 0.35);
      });
    } else {
      // placeholder shimmer
      for (let i = 0; i < 80; i++) {
        const ph = (Math.sin(i * 0.5) * 0.25 + 0.3) * H * 0.5;
        ctx.fillStyle = '#1a1d2a';
        ctx.fillRect(i * (W / 80) + 0.5, midY - ph / 2, W / 80 - 1, ph);
      }
    }

    // boundary lines
    ctx.lineWidth = 1.5;
    [selX, selX + selWx].forEach(lx => {
      ctx.strokeStyle = '#FF6F0F';
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
      // handle nub
      ctx.fillStyle = '#FF6F0F';
      ctx.beginPath(); ctx.arc(lx, H / 2, 5, 0, Math.PI * 2); ctx.fill();
    });

    // playback cursor
    if (playing && playPos > 0) {
      const px = selX + playPos * selWx;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }

    // time label
    const label = `${fmtSec(startSec)} – ${fmtSec(Math.min(startSec + windowSec, durationSec))}`;
    ctx.font      = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const lx = Math.min(selX + 5, W - 90);
    ctx.fillText(label, lx, H - 5);

  }, [peaks, startSec, durationSec, windowSec, playing, playPos]);

  // ── Pointer interaction ──
  const secFromX = useCallback((clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * durationSec;
  }, [durationSec]);

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    dragging.current = true;
    userDraggedRef.current = true;
    const sec = secFromX(e.clientX);
    lastSec.current = sec;
    const ns = Math.max(0, Math.min(sec - windowSec / 2, durationSec - windowSec));
    onStartChange(Math.round(ns));
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    userDraggedRef.current = true;
    const sec   = secFromX(e.clientX);
    const delta = sec - lastSec.current;
    lastSec.current = sec;
    onStartChange(Math.round(Math.max(0, Math.min(startSec + delta, durationSec - windowSec))));
  };
  const onMouseUp = () => { dragging.current = false; };

  // ── Playback ──
  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      cancelAnimationFrame(animFrameRef.current);
      setPlaying(false); setPlayPos(0);
    } else {
      onPlayStart?.();
      el.currentTime = startSec;
      el.play().then(() => {
        setPlaying(true);
        const tick = () => {
          if (!audioRef.current) return;
          const elapsed  = audioRef.current.currentTime - startSec;
          const progress = Math.min(elapsed / windowSec, 1);
          setPlayPos(progress);
          if (progress < 1 && !audioRef.current.paused) {
            animFrameRef.current = requestAnimationFrame(tick);
          } else {
            audioRef.current.pause();
            setPlaying(false); setPlayPos(0);
          }
        };
        animFrameRef.current = requestAnimationFrame(tick);
      }).catch((err) => {
        console.error('[WaveformEditor] play() 실패:', err);
      });
    }
  }, [playing, startSec, windowSec, onPlayStart]);

  // 구간 변경 시 재생 (드래그 직접 이동 or autoPlayOnSelect ON)
  useEffect(() => {
    const shouldPlay = userDraggedRef.current || autoPlayOnSelect;
    userDraggedRef.current = false; // 매번 리셋
    const el = audioRef.current;
    if (!el || !shouldPlay) return;
    cancelAnimationFrame(animFrameRef.current);
    setPlayPos(0);
    el.currentTime = startSec;
    onPlayStart?.();
    el.play().then(() => {
      setPlaying(true);
      const tick = () => {
        if (!audioRef.current) return;
        const elapsed  = audioRef.current.currentTime - startSec;
        const progress = Math.min(elapsed / windowSec, 1);
        setPlayPos(progress);
        if (progress < 1 && !audioRef.current.paused) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          audioRef.current.pause();
          setPlaying(false); setPlayPos(0);
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSec]);

  useEffect(() => () => cancelAnimationFrame(animFrameRef.current), []);

  // 외부에서 stopToken이 바뀌면 재생 중지
  useEffect(() => {
    if (stopToken === 0) return;
    if (audioRef.current) { audioRef.current.pause(); }
    cancelAnimationFrame(animFrameRef.current);
    setPlaying(false);
    setPlayPos(0);
  }, [stopToken]);

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 bg-[#0a0c14]/70 rounded-xl">
            <Loader2 size={13} className="animate-spin text-[#FF6F0F]" />
            <span className="text-xs text-muted">파형 분석 중...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`w-full rounded-xl block ${dragging.current ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          style={{ height: 96 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-[#FF6F0F] flex items-center justify-center hover:bg-[#e86200] transition shrink-0"
        >
          {playing
            ? <Pause size={11} className="text-white" />
            : <Play  size={11} className="text-white ml-0.5" />}
        </button>
        <div className="flex-1 flex justify-between text-[10px] font-mono text-muted">
          <span>0:00</span>
          <span className="text-[#FF9F4F]">
            {fmtSec(startSec)} → {fmtSec(Math.min(startSec + windowSec, durationSec))} ({windowSec}초)
          </span>
          <span>{fmtSec(durationSec)}</span>
        </div>
      </div>
    </div>
  );
}


// ─── 라이브 미리보기 프레임 ────────────────────────────────────────
interface LivePreviewFrameProps {
  audioUrl: string;
  coverUrl: string | null;
  coverEmoji: string;
  bgVideoUrl: string | null;
  startSec: number;
  durationSec: number;
  shortsTitle: string;
  shortsTagline: string;
  selectedCoupon: Coupon | null;
  trackTitle: string;
  artist: string;
  headerTop: number;
  infoTop: number;
  couponTop: number;
  genreTag?: string;
  moodTag?: string;
  waveformStyle?: 'bar' | 'mirror' | 'wave' | 'circle' | 'dots';
  coverAnimStyle?: 'none' | 'breathing' | 'beat' | 'vinyl';
  particleStyle?: 'none' | 'sakura' | 'bubbles' | 'hearts' | 'stars' | 'rose' | 'snow';
  bpm?: number;
  vinylBgBlur?: number;
  vinylPosX?: number;
  vinylPosY?: number;
  onVinylPosChange?: (x: number, y: number) => void;
  showGuide?: boolean;
  onPlayStart?: () => void;
  stopToken?: number;
}

const PARTICLE_EMOJI: Record<string, string> = {
  sakura: '🌸', bubbles: '🫧', hearts: '💕', stars: '✨', rose: '🌹', snow: '❄️',
};

function LivePreviewFrame({
  audioUrl, coverUrl, coverEmoji, bgVideoUrl,
  startSec, durationSec,
  shortsTitle, shortsTagline, selectedCoupon,
  trackTitle, artist,
  headerTop, infoTop, couponTop,
  genreTag, moodTag,
  waveformStyle = 'bar',
  coverAnimStyle = 'none',
  particleStyle = 'none',
  bpm = 120,
  vinylBgBlur = 14,
  vinylPosX = 50,
  vinylPosY = 28,
  onVinylPosChange,
  showGuide = false,
  onPlayStart,
  stopToken = 0,
}: LivePreviewFrameProps) {
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const animRef       = useRef<number>(0);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const vinylDragRef   = useRef<{ startX: number; startY: number; px: number; py: number } | null>(null);
  const [playing,       setPlaying]       = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [wavePhase,     setWavePhase]     = useState(0);
  const [frameWidth,    setFrameWidth]    = useState(360);
  const [couponAnimKey, setCouponAnimKey] = useState(0);
  const [liked,         setLiked]         = useState(false);

  // 기준 해상도 (이 크기로 모든 px 값 설계)
  const BASE_W = 360;
  const BASE_H = 640;
  const scale  = frameWidth / BASE_W;

  // 컨테이너 폭 감지 → scale 계산
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setFrameWidth(entries[0].contentRect.width || BASE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 웨이브폼 캔버스 드로우
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth  || BASE_W;
    const H = canvas.offsetHeight || 36;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const mid  = H / 2;
    const color  = (alpha: number) => playing ? `rgba(255,111,15,${alpha})` : `rgba(255,255,255,${alpha * 0.4})`;
    const getAmp = (i: number) =>
      playing ? Math.max(0.15, Math.abs(Math.sin((wavePhase + i * 0.55) * 1.3)) * 0.85) : 0.18 + 0.08 * Math.abs(Math.sin(i * 0.7));

    if (waveformStyle === 'bar') {
      const bars = 32; const bw = W / bars;
      for (let i = 0; i < bars; i++) {
        const amp = getAmp(i);
        const h = amp * H * 0.85;
        ctx.fillStyle = color(0.4 + amp * 0.6);
        ctx.fillRect(i * bw + 1, mid - h / 2, Math.max(bw - 2, 1), h);
      }

    } else if (waveformStyle === 'mirror') {
      const bars = 32; const bw = W / bars;
      for (let i = 0; i < bars; i++) {
        const amp = getAmp(i);
        const h = amp * H * 0.42;
        ctx.fillStyle = color(0.4 + amp * 0.6);
        ctx.fillRect(i * bw + 1, mid - h, Math.max(bw - 2, 1), h);        // 위
        ctx.fillRect(i * bw + 1, mid,      Math.max(bw - 2, 1), h);        // 아래
      }

    } else if (waveformStyle === 'wave') {
      const pts = 64;
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const amp = getAmp(i);
        const x = (i / pts) * W;
        const y = mid + Math.sin((wavePhase + i * 0.4) * 1.5) * amp * mid * 0.8;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color(0.85);
      ctx.lineWidth = 2.5;
      ctx.stroke();

    } else if (waveformStyle === 'circle') {
      const bars = 24;
      const cx = W / 2; const cy = H / 2;
      const baseR = Math.min(cx, cy) * 0.45;
      for (let i = 0; i < bars; i++) {
        const amp = getAmp(i);
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const r1 = baseR;
        const r2 = baseR + amp * H * 0.38;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.strokeStyle = color(0.4 + amp * 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

    } else if (waveformStyle === 'dots') {
      const dots = 32; const bw = W / dots;
      for (let i = 0; i < dots; i++) {
        const amp = getAmp(i);
        const r = Math.max(1.5, amp * H * 0.22);
        ctx.beginPath();
        ctx.arc(i * bw + bw / 2, mid, r, 0, Math.PI * 2);
        ctx.fillStyle = color(0.4 + amp * 0.6);
        ctx.fill();
      }
    }
  }, [playing, wavePhase, waveformStyle]);

  useEffect(() => {
    if (!playing) return;
    let phase = wavePhase;
    const tick = () => { phase += 0.12; setWavePhase(phase); animRef.current = requestAnimationFrame(tick); };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      cancelAnimationFrame(animRef.current);
      setPlaying(false);
      setProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSec]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  // 외부에서 stopToken이 바뀌면 재생 중지
  useEffect(() => {
    if (stopToken === 0) return;
    if (audioRef.current) { audioRef.current.pause(); }
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    setProgress(0);
  }, [stopToken]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      cancelAnimationFrame(animRef.current);
      setPlaying(false);
      setProgress(0);
    } else {
      onPlayStart?.();
      el.currentTime = startSec;
      el.play().then(() => {
        setPlaying(true);
        setCouponAnimKey(k => k + 1);
        const startTime = performance.now();
        const totalMs   = durationSec * 1000;
        const tick = () => {
          const elapsed = performance.now() - startTime;
          const pct = Math.min(elapsed / totalMs, 1);
          setProgress(pct);
          if (pct < 1 && !el.paused) {
            animRef.current = requestAnimationFrame(tick);
          } else {
            el.pause();
            setPlaying(false);
            setProgress(0);
          }
        };
        animRef.current = requestAnimationFrame(tick);
      }).catch((err) => {
        console.error('[LivePreviewFrame] play() 실패:', err);
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <style>{`
        @keyframes couponSlideIn {
          0%   { opacity: 0; transform: translateY(24px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes coverBreath {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.025); }
        }
        @keyframes coverBeat {
          0%   { transform: scale(1.035); filter: brightness(1.15); }
          100% { transform: scale(1);     filter: brightness(1); }
        }
        @keyframes particleFall {
          0%   { transform: translateY(-10%) rotate(0deg);   opacity:0; }
          10%  { opacity:0.85; }
          90%  { opacity:0.7; }
          100% { transform: translateY(110%) rotate(360deg); opacity:0; }
        }
        @keyframes particleFloat {
          0%   { transform: translateY(110%) rotate(0deg);   opacity:0; }
          10%  { opacity:0.85; }
          90%  { opacity:0.7; }
          100% { transform: translateY(-10%) rotate(-20deg); opacity:0; }
        }
        @keyframes particleTwinkle {
          0%,100% { opacity:0.1; transform: scale(0.6); }
          50%     { opacity:0.9; transform: scale(1.1); }
        }
        @keyframes vinylSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <p className="text-[10px] text-dim self-start">라이브 미리보기</p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* 9:16 외부 컨테이너 — 폭 감지용 */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden w-full"
        style={{ aspectRatio: '9/16', background: '#111' }}
      >
        {/* 기준 크기(360×640) 내부 래퍼 — scale로 비례 확대/축소 */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width:  BASE_W,
            height: BASE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* 배경 */}
          {bgVideoUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={bgVideoUrl} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} muted loop autoPlay playsInline />
          ) : coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" style={{
              position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover',
              filter: coverAnimStyle === 'vinyl' ? `brightness(0.3) blur(${vinylBgBlur / 2}px)` : undefined,
              animation: coverAnimStyle === 'breathing' ? `coverBreath ${(60 / bpm) * 4}s ease-in-out infinite`
                       : coverAnimStyle === 'beat'      ? `coverBeat ${60 / bpm}s ease-out infinite`
                       : undefined,
            }} />
          ) : (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:80, background:'#1a1a2e',
              animation: coverAnimStyle === 'breathing' ? `coverBreath ${(60 / bpm) * 4}s ease-in-out infinite` : undefined,
            }}>{coverEmoji}</div>
          )}

          {/* 바이닐 디스크 오버레이 (이미지 모드 전용) */}
          {!bgVideoUrl && coverAnimStyle === 'vinyl' && (
            <div
              style={{
                position: 'absolute',
                left: `${vinylPosX}%`,
                top: `${vinylPosY}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'grab',
                userSelect: 'none',
              }}
              onMouseDown={e => {
                e.preventDefault();
                vinylDragRef.current = { startX: e.clientX, startY: e.clientY, px: vinylPosX, py: vinylPosY };
                const onMove = (me: MouseEvent) => {
                  if (!vinylDragRef.current || !containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  const dx = (me.clientX - vinylDragRef.current.startX) / rect.width  * 100;
                  const dy = (me.clientY - vinylDragRef.current.startY) / rect.height * 100;
                  const nx = Math.max(10, Math.min(90, vinylDragRef.current.px + dx));
                  const ny = Math.max(5,  Math.min(92, vinylDragRef.current.py + dy));
                  onVinylPosChange?.(nx, ny);
                };
                const onUp = () => {
                  vinylDragRef.current = null;
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              <div style={{ position:'relative', width:160, height:160 }}>
                <div style={{ width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,#242424 0%,#0a0a0a 100%)', animation:'vinylSpin 4s linear infinite', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 12px 40px rgba(0,0,0,0.8)' }}>
                  {[1,2,3,4].map(k => <div key={k} style={{ position:'absolute', width:160-k*28, height:160-k*28, borderRadius:'50%', border:'0.5px solid rgba(255,255,255,0.05)', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />)}
                  <div style={{ width:62, height:62, borderRadius:'50%', overflow:'hidden', zIndex:1 }}>
                    {coverUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={coverUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div style={{ width:'100%', height:'100%', background:'#2a2a3a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{coverEmoji}</div>}
                  </div>
                </div>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:10, height:10, borderRadius:'50%', background:'#030303', border:'1.5px solid rgba(255,255,255,0.15)', zIndex:10 }} />
              </div>
            </div>
          )}

          {/* 파티클 오버레이 */}
          {particleStyle !== 'none' && (
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
              {Array.from({ length: 9 }, (_, i) => {
                const isFalling = particleStyle === 'sakura' || particleStyle === 'rose' || particleStyle === 'snow';
                const isTwinkle = particleStyle === 'stars';
                return (
                  <div key={i} style={{
                    position:'absolute',
                    left: `${8 + i * 10}%`,
                    top: isFalling ? '-5%' : isTwinkle ? `${10 + i * 9}%` : undefined,
                    bottom: (!isFalling && !isTwinkle) ? '-5%' : undefined,
                    fontSize: particleStyle === 'bubbles' ? 20 : particleStyle === 'stars' ? 14 : 16,
                    animation: isTwinkle
                      ? `particleTwinkle ${1.5 + i * 0.4}s ${i * 0.25}s ease-in-out infinite`
                      : isFalling
                      ? `particleFall ${3.5 + i * 0.6}s ${i * 0.35}s ease-in-out infinite`
                      : `particleFloat ${3 + i * 0.5}s ${i * 0.3}s ease-in-out infinite`,
                  }}>
                    {PARTICLE_EMOJI[particleStyle] ?? '✨'}
                  </div>
                );
              })}
            </div>
          )}

          {/* 그라디언트 */}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.05) 45%,rgba(0,0,0,0.78) 100%)' }} />

          {/* 제목 / 강조 문구 */}
          <div style={{ position:'absolute', left:16, right:16, top:`${headerTop}%` }}>
            {shortsTitle   && <p style={{ color:'#fff', fontSize:22, fontWeight:900, lineHeight:1.25, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{shortsTitle}</p>}
            {shortsTagline && <p style={{ color:'#FF9F4F', fontSize:16, fontWeight:700, marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shortsTagline}</p>}
          </div>

          {/* 쿠폰 */}
          {selectedCoupon && (
            <div key={couponAnimKey} style={{ position:'absolute', left:16, right:16, top:`${couponTop}%`, animation: couponAnimKey > 0 ? 'couponSlideIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' : 'none' }}>
              <div style={{ background:'rgba(255,111,15,0.92)', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:24 }}>🎟</span>
                <div style={{ minWidth:0 }}>
                  <p style={{ color:'#fff', fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedCoupon.title}</p>
                  <p style={{ color:'#fff', fontSize:17, fontWeight:900, marginTop:2 }}>
                    {selectedCoupon.discount_type === 'percent'
                      ? `${selectedCoupon.discount_value}% 할인`
                      : `${selectedCoupon.discount_value.toLocaleString()}원 할인`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 곡 정보 */}
          <div style={{ position:'absolute', left:16, right:16, top:`${infoTop}%` }}>
            <p style={{ color:'#fff', fontSize:15, fontWeight:600, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🎵 {trackTitle}</p>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:12, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{artist}</p>
          </div>

          {/* 언니픽 배지 */}
          <div style={{ position:'absolute', top:12, right:12, background:'rgba(255,111,15,0.92)', borderRadius:5, color:'#fff', fontSize:11, fontWeight:700, padding:'3px 7px' }}>언니픽</div>

          {/* 장르·무드 태그 */}
          {(genreTag || moodTag) && (
            <div style={{ position:'absolute', bottom:90, left:16, display:'flex', gap:6 }}>
              {genreTag && (
                <span style={{ background:'rgba(255,111,15,0.85)', color:'#fff', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>
                  #{genreTag}
                </span>
              )}
              {moodTag && (
                <span style={{ background:'rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.9)', fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, backdropFilter:'blur(4px)' }}>
                  #{moodTag}
                </span>
              )}
            </div>
          )}

          {/* 좋아요 버튼 */}
          <button
            onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
            style={{
              position:'absolute', right:14, bottom:110,
              width:44, height:44, borderRadius:'50%',
              background: liked ? 'rgba(255,59,95,0.85)' : 'rgba(0,0,0,0.4)',
              border: liked ? 'none' : '1px solid rgba(255,255,255,0.25)',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
              cursor:'pointer', transition:'transform 0.15s, background 0.2s',
              transform: liked ? 'scale(1.12)' : 'scale(1)',
            }}
          >
            <Heart size={20} fill={liked ? '#fff' : 'none'} color={liked ? '#fff' : 'rgba(255,255,255,0.9)'} />
            <span style={{ fontSize:9, color:'rgba(255,255,255,0.8)', fontWeight:600, lineHeight:1 }}>
              {liked ? '♥' : '좋아요'}
            </span>
          </button>

          {/* 파형 */}
          <div style={{ position:'absolute', bottom:44, left:16, right:16 }}>
            <canvas ref={canvasRef} style={{ width:'100%', display:'block', height:36 }} />
          </div>

          {/* 진행 바 */}
          <div style={{ position:'absolute', bottom:22, left:16, right:16, height:3, background:'rgba(255,255,255,0.15)', borderRadius:2 }}>
            <div style={{ height:'100%', width:`${progress * 100}%`, background:'#FF6F0F', borderRadius:2 }} />
          </div>

          {/* 시간 표시 */}
          <div style={{ position:'absolute', bottom:4, left:16, right:16, display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.5)' }}>{fmtSec(startSec + progress * durationSec)}</span>
            <span style={{ fontSize:12, fontFamily:'monospace', color:'rgba(255,255,255,0.3)' }}>{fmtSec(startSec + durationSec)}</span>
          </div>

          {/* 안전 영역 가이드 */}
          {showGuide && (
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:20 }}>
              {/* ── 상단 안전바 (Instagram 10% / YouTube 7%) ── */}
              {/* YouTube 상단 7% */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'7%', background:'rgba(255,59,59,0.18)', borderBottom:'1.5px dashed rgba(255,90,90,0.75)' }}>
                <span style={{ position:'absolute', bottom:2, left:5, fontSize:7, color:'rgba(255,130,130,0.95)', fontWeight:700, letterSpacing:0.3 }}>▶ YT 상단</span>
              </div>
              {/* Instagram 상단 10% */}
              <div style={{ position:'absolute', top:'7%', left:0, right:0, height:'3%', background:'rgba(255,111,15,0.18)', borderBottom:'1.5px dashed rgba(255,150,50,0.8)' }}>
                <span style={{ position:'absolute', bottom:2, left:5, fontSize:7, color:'rgba(255,170,80,0.95)', fontWeight:700 }}>📷 IG 상단</span>
              </div>

              {/* ── 하단 안전바 (Instagram 20% / YouTube 25%) ── */}
              {/* Instagram 하단 20% */}
              <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'20%', background:'rgba(255,111,15,0.18)', borderTop:'1.5px dashed rgba(255,150,50,0.8)' }}>
                <span style={{ position:'absolute', top:3, left:5, fontSize:7, color:'rgba(255,170,80,0.95)', fontWeight:700 }}>📷 IG 하단 액션</span>
              </div>
              {/* YouTube 하단 추가 5% (총 25%) */}
              <div style={{ position:'absolute', bottom:'20%', left:0, right:0, height:'5%', background:'rgba(255,59,59,0.18)', borderTop:'1.5px dashed rgba(255,90,90,0.75)' }}>
                <span style={{ position:'absolute', top:2, left:5, fontSize:7, color:'rgba(255,130,130,0.95)', fontWeight:700 }}>▶ YT 하단</span>
              </div>

              {/* ── 우측 액션 버튼 영역 (Instagram 15% / YouTube 12%) ── */}
              {/* YouTube 우측 12% */}
              <div style={{ position:'absolute', top:'7%', right:0, bottom:'20%', width:'12%', background:'rgba(255,59,59,0.13)', borderLeft:'1.5px dashed rgba(255,90,90,0.75)' }}>
                <span style={{ position:'absolute', top:'50%', right:1, transform:'translateY(-50%) rotate(90deg)', transformOrigin:'center', fontSize:7, color:'rgba(255,130,130,0.9)', fontWeight:700, whiteSpace:'nowrap' }}>▶ YT</span>
              </div>
              {/* Instagram 우측 15% (추가 3%) */}
              <div style={{ position:'absolute', top:'10%', right:'12%', bottom:'20%', width:'3%', background:'rgba(255,111,15,0.13)', borderLeft:'1.5px dashed rgba(255,150,50,0.7)' }}>
                <span style={{ position:'absolute', top:'50%', right:0, transform:'translateY(-50%) rotate(90deg)', transformOrigin:'center', fontSize:6, color:'rgba(255,170,80,0.85)', fontWeight:700, whiteSpace:'nowrap' }}>📷</span>
              </div>

              {/* ── 안전 영역 레이블 ── */}
              <div style={{ position:'absolute', top:'10%', left:5, background:'rgba(0,0,0,0.55)', borderRadius:4, padding:'2px 6px', border:'1px solid rgba(255,255,255,0.15)' }}>
                <span style={{ fontSize:8, color:'rgba(255,255,255,0.8)', fontWeight:700 }}>SAFE ZONE</span>
              </div>

              {/* 범례 */}
              <div style={{ position:'absolute', top:'10%', right:'15%', display:'flex', flexDirection:'column', gap:2, background:'rgba(0,0,0,0.6)', borderRadius:4, padding:'3px 5px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <div style={{ width:8, height:1.5, background:'rgba(255,150,50,0.9)' }} />
                  <span style={{ fontSize:6.5, color:'rgba(255,170,80,0.9)', fontWeight:700 }}>Instagram</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <div style={{ width:8, height:1.5, background:'rgba(255,90,90,0.9)' }} />
                  <span style={{ fontSize:6.5, color:'rgba(255,130,130,0.9)', fontWeight:700 }}>YouTube</span>
                </div>
              </div>
            </div>
          )}

          {/* 재생 버튼 */}
          <button
            onClick={togglePlay}
            style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity: playing ? 0 : 1, transition:'opacity 0.2s' }}
            onMouseEnter={e => { if (playing) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            onMouseLeave={e => { if (playing) (e.currentTarget as HTMLButtonElement).style.opacity = '0'; }}
          >
            <div style={{ width:64, height:64, borderRadius:'50%', background: playing ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
              {playing
                ? <Pause size={24} color="white" />
                : <Play  size={24} color="white" style={{ marginLeft:3 }} />}
            </div>
          </button>
        </div>
      </div>

      {/* 구간 표시 */}
      <p className="text-[10px] font-mono text-dim self-start">
        {fmtSec(startSec)} ~ {fmtSec(startSec + durationSec)}
        <span className="text-[#FF6F0F]/60 ml-1">({durationSec}초)</span>
      </p>
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────
function ShortsPageInner() {
  const sb           = createClient();
  const player       = usePlayer();
  const searchParams = useSearchParams();
  const initTrackId  = searchParams.get('trackId');

  // 트랙 목록
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [filtered, setFiltered] = useState<MusicTrack[]>([]);
  const [query, setQuery] = useState('');
  const [loadingTracks, setLoadingTracks] = useState(true);

  // 선택된 트랙
  const [selected, setSelected] = useState<MusicTrack | null>(null);

  // 클라이맥스 / 시작 시간
  const [startSec, setStartSec] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);


  // 쿠폰
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  // 안내방송
  const [announcements, setAnnouncements] = useState<AnnItem[]>([]);
  const [selectedAnn, setSelectedAnn] = useState<AnnItem | null>(null);
  const [annDuration, setAnnDuration] = useState(0);

  // 커버 이미지 (기본: 트랙 커버, 변경 가능)
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // 배경 동영상
  const [bgVideoFile, setBgVideoFile] = useState<File | null>(null);
  const [bgVideoPreviewUrl, setBgVideoPreviewUrl] = useState<string | null>(null);
  const [bgVideoDurationSec, setBgVideoDurationSec] = useState(0);
  const [uploadingBgVideo, setUploadingBgVideo] = useState(false);

  // 숏폼 제목 / 강조 문구
  const [shortsTitle, setShortsTitle] = useState('제목을 입력하세요');
  const [shortsTagline, setShortsTagline] = useState('부제목을 입력하세요');

  // 오디오 페이드인 / 파형 스타일
  const [audioFadeInSec, setAudioFadeInSec] = useState(1.5);
  const [waveformStyle, setWaveformStyle] = useState<'bar' | 'mirror' | 'wave' | 'circle' | 'dots'>('bar');
  const [coverAnimStyle, setCoverAnimStyle] = useState<'none' | 'breathing' | 'beat' | 'vinyl'>('none');
  const [particleStyle, setParticleStyle]   = useState<'none' | 'sakura' | 'bubbles' | 'hearts' | 'stars' | 'rose' | 'snow'>('none');
  const [vinylBgBlur, setVinylBgBlur] = useState(14);
  const [vinylPosX,   setVinylPosX]   = useState(50); // % of container
  const [vinylPosY,   setVinylPosY]   = useState(28);
  const [durationSec, setDurationSec] = useState(20);

  // 요소 위치 (% from top)
  const [headerTop, setHeaderTop] = useState(11);
  const [infoTop, setInfoTop] = useState(72);
  const [couponTop, setCouponTop] = useState(60);

  // 렌더링
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);

  // 히스토리
  const [history, setHistory] = useState<ShortsHistoryItem[]>([]);
  const [playingHistory, setPlayingHistory] = useState<ShortsHistoryItem | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const toggleLike = (id: string) => {
    setLikedIds(prev => {
      const s = new Set(prev);
      const wasLiked = s.has(id);
      wasLiked ? s.delete(id) : s.add(id);
      // likeCount를 히스토리에도 저장
      const updated = history.map(h =>
        h.id === id ? { ...h, likeCount: Math.max(0, (h.likeCount ?? 0) + (wasLiked ? -1 : 1)) } : h,
      );
      setHistory(updated);
      saveShortsHistory(updated);
      return s;
    });
  };
  const wasPlayingRef = useRef(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [autoPlayOnSelect, setAutoPlayOnSelect] = useState(false);
  // 재생 중지 토큰: 각 플레이어는 상대방이 재생 시작할 때 올라가는 토큰만 감시
  const [waveStopToken, setWaveStopToken] = useState(0); // WaveformEditor가 감시 (LivePreview 재생 시 증가)
  const [liveStopToken, setLiveStopToken] = useState(0); // LivePreviewFrame이 감시 (Waveform 재생 시 증가)
  const [showGuide, setShowGuide] = useState<boolean>(() => {
    try { return localStorage.getItem('shorts_show_guide') === 'true'; } catch { return false; }
  });
  const toggleGuide = () => setShowGuide(v => {
    const next = !v;
    try { localStorage.setItem('shorts_show_guide', String(next)); } catch {}
    return next;
  });
  useEffect(() => { setHistory(loadShortsHistory()); }, []);

  const openHistoryPlayer = (h: ShortsHistoryItem) => {
    wasPlayingRef.current = player.isPlaying;
    if (player.isPlaying) player.pause();
    setPlayingHistory(h);
  };

  const closeHistoryPlayer = () => {
    setPlayingHistory(null);
    if (wasPlayingRef.current) player.resume();
  };

  // 페이지네이션
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageTracks = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    loadTracks();
    // 활성 쿠폰 로드
    sb.from('coupons')
      .select('id, title, discount_type, discount_value, is_active, expires_at')
      .eq('is_active', true)
      .then(({ data }) => setCoupons((data as Coupon[]) ?? []));
    // audio_url이 있는 안내방송 로드
    sb.from('announcements')
      .select('id, text, audio_url, voice_type, created_at')
      .not('audio_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setAnnouncements((data as AnnItem[]) ?? []));
  }, []);

  const loadTracks = async () => {
    setLoadingTracks(true);
    const { data, error } = await sb
      .from('music_tracks')
      .select(
        'id, title, artist, audio_url, cover_image_url, cover_emoji, duration_sec, bpm, energy_level, mood, mood_tags, energy_score',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setTracks(data as MusicTrack[]);
      setFiltered(data as MusicTrack[]);
      // URL 파라미터로 전달된 트랙 자동 선택
      if (initTrackId) {
        const found = (data as MusicTrack[]).find(t => t.id === initTrackId);
        if (found) handleSelect(found);
      }
    }
    setLoadingTracks(false);
  };

  // ── 검색 필터 ──
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setFiltered(tracks);
    } else {
      setFiltered(
        tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.mood_tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
        ),
      );
    }
    setPage(0);
  }, [query, tracks]);

  // ── 트랙 선택 ──
  const handleSelect = (track: MusicTrack) => {
    setSelected(track);
    setStartSec(Math.floor(track.duration_sec * 0.35));
    setAnalyzed(false);
    setVideoUrl(null);
    setRenderError(null);
    setCoverFile(null);
    setCoverPreviewUrl(null);
  };

  // ── 커버 이미지 변경 ──
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);
    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = '';
  };

  const handleCoverReset = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(null);
    setCoverPreviewUrl(null);
  };

  // ── 배경 동영상 변경 ──
  const handleBgVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgVideoFile(file);
    const url = URL.createObjectURL(file);
    setBgVideoPreviewUrl(url);
    // 동영상 길이 측정
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.src = url;
    vid.onloadedmetadata = () => setBgVideoDurationSec(vid.duration || 0);
    e.target.value = '';
  };

  const handleBgVideoReset = () => {
    if (bgVideoPreviewUrl) URL.revokeObjectURL(bgVideoPreviewUrl);
    setBgVideoFile(null);
    setBgVideoPreviewUrl(null);
    setBgVideoDurationSec(0);
  };

  // ── 안내방송 선택 (오디오 길이 측정) ──
  const handleSelectAnn = (ann: AnnItem | null) => {
    if (!ann) {
      setSelectedAnn(null);
      setAnnDuration(0);
      return;
    }
    setSelectedAnn(ann);
    // HTMLAudioElement로 실제 길이 측정
    const audio = new window.Audio(ann.audio_url);
    audio.addEventListener('loadedmetadata', () => {
      setAnnDuration(audio.duration || 0);
    });
    audio.addEventListener('error', () => {
      setAnnDuration(0);
    });
  };

  // ── 클라이맥스 자동 감지 ──
  const handleAnalyze = async () => {
    if (!selected) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/shorts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: selected.audio_url,
          duration_sec: selected.duration_sec,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '분석 실패');
      setStartSec(json.start_sec);
      setAnalyzed(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── 숏폼 렌더링 요청 ──
  const handleRender = async () => {
    if (!selected) return;
    setRendering(true);
    setVideoUrl(null);
    setRenderError(null);
    try {
      // 커버 이미지 변경됐으면 Storage에 업로드 후 공개 URL 사용
      let finalCoverUrl = selected.cover_image_url;
      if (coverFile) {
        setUploadingCover(true);
        const ext = coverFile.name.split('.').pop() || 'jpg';
        const filename = `covers/shorts_${selected.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage
          .from('music-tracks')
          .upload(filename, coverFile, { upsert: true });
        setUploadingCover(false);
        if (upErr) throw new Error(`커버 업로드 실패: ${upErr.message}`);
        const { data: urlData } = sb.storage.from('music-tracks').getPublicUrl(filename);
        finalCoverUrl = urlData.publicUrl;
      }

      // 배경 동영상 업로드
      let finalBgVideoUrl: string | null = null;
      if (bgVideoFile) {
        setUploadingBgVideo(true);
        const ext = bgVideoFile.name.split('.').pop() || 'mp4';
        const filename = `bgvideo/shorts_${selected.id}_${Date.now()}.${ext}`;
        const { error: vidErr } = await sb.storage
          .from('music-tracks')
          .upload(filename, bgVideoFile, { upsert: true, contentType: bgVideoFile.type });
        setUploadingBgVideo(false);
        if (vidErr) throw new Error(`배경 동영상 업로드 실패: ${vidErr.message}`);
        const { data: vidUrlData } = sb.storage.from('music-tracks').getPublicUrl(filename);
        finalBgVideoUrl = vidUrlData.publicUrl;
      }

      const res = await fetch('/api/shorts/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: selected.id,
          audio_url: selected.audio_url,
          cover_url: finalBgVideoUrl ? null : finalCoverUrl,
          title: selected.title,
          artist: selected.artist,
          cover_emoji: selected.cover_emoji,
          start_sec: startSec,
          mood_tags: selected.mood_tags ?? [],
          shorts_title: shortsTitle.trim(),
          shorts_tagline: shortsTagline.trim(),
          coupon: selectedCoupon
            ? { title: selectedCoupon.title, discount_type: selectedCoupon.discount_type, discount_value: selectedCoupon.discount_value }
            : null,
          announcement_url: selectedAnn?.audio_url ?? '',
          announcement_duration_sec: annDuration,
          element_positions: { headerTop, infoTop, couponTop },
          audio_fade_in_sec: audioFadeInSec,
          waveform_style: waveformStyle,
          duration_sec: durationSec,
          bg_video_url: finalBgVideoUrl,
          bg_video_duration_sec: bgVideoDurationSec,
          cover_anim_style: coverAnimStyle,
          particle_style: particleStyle,
          bpm: selected.bpm ?? 120,
          vinyl_pos_x: vinylPosX,
          vinyl_pos_y: vinylPosY,
          vinyl_bg_blur: vinylBgBlur,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '렌더링 실패');
      setVideoUrl(json.video_url);
      // 히스토리에 저장
      const item: ShortsHistoryItem = {
        id: `shorts_${Date.now()}`,
        trackId: selected.id,
        trackTitle: selected.title,
        artist: selected.artist,
        coverUrl: selected.cover_image_url,
        coverEmoji: selected.cover_emoji,
        videoUrl: json.video_url,
        startSec,
        moodTags: selected.mood_tags ?? [],
        createdAt: new Date().toISOString(),
        waveformStyle,
        durationSec,
        shortsTitle,
        shortsTagline,
        audioFadeInSec,
      };
      pushShortsHistory(item);
      setHistory(loadShortsHistory());
    } catch (e) {
      setRenderError((e as Error).message);
    } finally {
      setRendering(false);
    }
  };



  // 현재 선택 트랙의 기존 숏폼 필터
  const trackHistory = selected
    ? history.filter(h => h.trackId === selected.id)
    : [];

  // 히스토리에서 설정 복원
  const loadFromHistory = (h: ShortsHistoryItem) => {
    setStartSec(h.startSec);
    if (h.waveformStyle)    setWaveformStyle(h.waveformStyle);
    if (h.durationSec)      setDurationSec(h.durationSec);
    if (h.shortsTitle    !== undefined) setShortsTitle(h.shortsTitle ?? '');
    if (h.shortsTagline  !== undefined) setShortsTagline(h.shortsTagline ?? '');
    if (h.audioFadeInSec !== undefined) setAudioFadeInSec(h.audioFadeInSec ?? 1.5);
    setVideoUrl(null);
    setRenderError(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f1117]">
      {/* ── 헤더 ── */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[#FF6F0F]/15 flex items-center justify-center">
          <Film size={18} className="text-[#FF6F0F]" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-primary">숏폼 영상 생성</h1>
          <p className="text-xs text-muted mt-0.5">
            음악 트랙에서 클라이맥스 구간을 추출해 9:16 숏폼 영상(30초)을 생성합니다.
          </p>
        </div>
        {/* 선택 즉시 재생 토글 */}
        <button
          onClick={() => setAutoPlayOnSelect(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
            autoPlayOnSelect
              ? 'bg-[#FF6F0F] border-[#FF6F0F] text-white shadow-lg shadow-[#FF6F0F]/30'
              : 'bg-white/5 border-white/10 text-muted hover:border-white/20 hover:text-primary'
          }`}
          title="트랙 선택 시 클라이맥스 구간 즉시 재생"
        >
          <span className={`w-2 h-2 rounded-full ${autoPlayOnSelect ? 'bg-white animate-pulse' : 'bg-white/30'}`} />
          {autoPlayOnSelect
            ? '음악 트랙선택 시 즉시 재생 기능이 켜져 있습니다.'
            : '음악 트랙선택 시 즉시 재생 기능이 꺼져 있습니다.'}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── 왼쪽: 트랙 선택 패널 ── */}
        <div className="w-[360px] shrink-0 border-r border-white/5 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-primary">트랙 선택</p>

            {/* 검색 */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="제목, 아티스트, 태그 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#0f1117] border border-border-main rounded-lg pl-8 pr-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]/50"
              />
            </div>

            {/* 트랙 목록 */}
            {loadingTracks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted" />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {pageTracks.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">트랙이 없습니다.</p>
                ) : (
                  pageTracks.map((track) => {
                    const isSelected = selected?.id === track.id;
                    return (
                      <button
                        key={track.id}
                        onClick={() => handleSelect(track)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition w-full ${
                          isSelected
                            ? 'bg-[#FF6F0F]/15 border border-[#FF6F0F]/40'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {/* 커버 */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                          {track.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={track.cover_image_url}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg">{track.cover_emoji || '🎵'}</span>
                          )}
                        </div>

                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{track.title}</p>
                          <p className="text-xs text-muted truncate">{track.artist}</p>
                          {/* 장르 + 무드태그 */}
                          {(track.mood || (track.mood_tags ?? []).length > 0) && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {track.mood && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF6F0F]/15 text-[#FF9F4F] font-semibold leading-none shrink-0">
                                  {track.mood}
                                </span>
                              )}
                              {(track.mood_tags ?? []).slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 leading-none shrink-0">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 메타 */}
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-xs text-muted">{fmtSec(track.duration_sec)}</p>
                          {track.bpm && (
                            <p className="text-[10px] text-dim">{track.bpm} BPM</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-muted transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-muted">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-muted transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 2단: 기본 설정 패널 ── */}
        <div className="w-[300px] shrink-0 border-r border-white/5 overflow-y-auto p-4 flex flex-col gap-4">
          {selected && (
            <>
              {/* ── 선택 트랙 정보 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex gap-4 items-start">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                  {selected.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.cover_image_url}
                      alt={selected.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">{selected.cover_emoji || '🎵'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-primary truncate">{selected.title}</h2>
                  <p className="text-sm text-muted mt-0.5">{selected.artist}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(selected.mood_tags ?? []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6F0F]/15 text-[#FF9F4F] border border-[#FF6F0F]/20"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted">전체 길이</p>
                  <p className="text-sm font-semibold text-primary mt-0.5">
                    {fmtSec(selected.duration_sec)}
                  </p>
                  {selected.bpm && (
                    <p className="text-xs text-muted mt-1">{selected.bpm} BPM</p>
                  )}
                </div>
              </div>

              {/* ── 이 트랙의 기존 숏폼 ── */}
              {trackHistory.length > 0 && (
                <div className="bg-card border border-[#FF6F0F]/30 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      <Film size={14} className="text-[#FF6F0F]" />
                      이 트랙의 숏폼 영상
                      <span className="text-xs font-normal text-muted">{trackHistory.length}개</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-4">
                    {trackHistory.map(h => (
                      <div key={h.id} className="flex flex-col gap-2">
                        {/* 썸네일 */}
                        <div
                          className="relative rounded-xl overflow-hidden cursor-pointer group bg-black w-full"
                          style={{ aspectRatio: '9/16' }}
                          onClick={() => openHistoryPlayer(h)}
                        >
                          <video
                            src={h.videoUrl}
                            className="w-full h-full object-cover"
                            muted playsInline
                            onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                              <Play size={18} className="text-black ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-2 right-2 text-[10px] text-white/70 bg-black/50 rounded px-1.5 py-0.5">
                            {new Date(h.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        {/* 액션 */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => loadFromHistory(h)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#FF6F0F]/15 text-[#FF9F4F] text-xs font-semibold hover:bg-[#FF6F0F]/25 transition"
                          >
                            <RotateCcw size={11} /> 설정 불러오기
                          </button>
                          <a
                            href={h.videoUrl}
                            download={`shorts_${h.trackTitle}.mp4`}
                            className="flex items-center justify-center px-3 rounded-lg bg-white/5 text-muted hover:bg-white/10 transition"
                          >
                            <Download size={13} />
                          </a>
                          <button
                            onClick={() => { removeShortsHistory(h.id); setHistory(loadShortsHistory()); }}
                            className="flex items-center justify-center px-3 rounded-lg bg-white/5 text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 커버 이미지 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">커버 이미지</p>
                <div className="flex items-center gap-4">
                  {/* 미리보기 */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                    {(coverPreviewUrl || selected.cover_image_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverPreviewUrl ?? selected.cover_image_url!}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">{selected.cover_emoji || '🎵'}</span>
                    )}
                    {uploadingCover && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-white" />
                      </div>
                    )}
                    {coverPreviewUrl && (
                      <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-[#FF6F0F]" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-muted">
                      기본값은 트랙 커버입니다. 9:16 비율 이미지를 권장합니다.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border-main text-xs text-muted hover:text-primary hover:bg-white/10 transition">
                        <ImageIcon size={12} />
                        이미지 변경
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCoverChange}
                        />
                      </label>
                      {coverPreviewUrl && (
                        <button
                          onClick={handleCoverReset}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border-main text-xs text-muted hover:text-red-400 hover:border-red-500/30 transition"
                        >
                          <RotateCcw size={12} />
                          원본 복원
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 배경 동영상 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">배경 동영상</p>
                    <p className="text-xs text-muted mt-0.5">업로드 시 커버 이미지 대신 사용. 음원 길이만큼 반복 재생.</p>
                  </div>
                  {bgVideoPreviewUrl && (
                    <button onClick={handleBgVideoReset} className="text-xs text-dim hover:text-red-400 transition flex items-center gap-1">
                      <RotateCcw size={11} /> 제거
                    </button>
                  )}
                </div>

                {bgVideoPreviewUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxWidth: 100 }}>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={bgVideoPreviewUrl}
                      className="w-full h-full object-cover"
                      muted loop autoPlay playsInline
                    />
                    {uploadingBgVideo && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 right-1 text-center">
                      <span className="text-[8px] text-white/80 bg-black/50 rounded px-1">
                        {bgVideoDurationSec > 0 ? `${bgVideoDurationSec.toFixed(1)}초` : '측정중...'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border-main rounded-xl py-6 hover:border-[#FF6F0F]/50 hover:bg-[#FF6F0F]/5 transition">
                    <Film size={20} className="text-muted" />
                    <span className="text-xs text-muted">동영상 파일 선택 (MP4, MOV)</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleBgVideoChange}
                    />
                  </label>
                )}
              </div>

              {/* ── 숏폼 제목 / 강조 문구 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">영상 텍스트</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted mb-1 block">숏폼 제목 (상단 큰 텍스트)</label>
                    <input
                      type="text"
                      placeholder="예: 가을 감성 플레이리스트"
                      value={shortsTitle}
                      onChange={(e) => setShortsTitle(e.target.value)}
                      className="w-full bg-[#0f1117] border border-border-main rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">강조 문구 (서브 텍스트)</label>
                    <input
                      type="text"
                      placeholder="예: 언니픽이 큐레이션한 매장 BGM"
                      value={shortsTagline}
                      onChange={(e) => setShortsTagline(e.target.value)}
                      className="w-full bg-[#0f1117] border border-border-main rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FF6F0F]/50"
                    />
                  </div>
                  <p className="text-[10px] text-muted">비워두면 해당 텍스트는 영상에 표시되지 않습니다.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 3단: 구간 설정 & 생성 패널 ── */}
        <div className="flex-1 border-r border-white/5 overflow-y-auto p-4 flex flex-col gap-4">
          {selected && (
            <>
              {/* ── 음원 설정 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-4">
                <p className="text-sm font-semibold text-primary">음원 설정</p>

                {/* 페이드인 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted">도입부 페이드인</label>
                    <span className="text-xs font-semibold text-primary tabular-nums">{audioFadeInSec.toFixed(1)}초</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={audioFadeInSec}
                    onChange={e => setAudioFadeInSec(Number(e.target.value))}
                    className="w-full accent-[#FF6F0F]"
                  />
                  <div className="flex justify-between text-[10px] text-dim mt-0.5">
                    <span>즉시</span>
                    <span>5초</span>
                  </div>
                </div>

                {/* 영상 길이 */}
                <div>
                  <p className="text-xs text-muted mb-2">영상 길이</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[10, 15, 20, 25, 30].map(sec => (
                      <button
                        key={sec}
                        onClick={() => setDurationSec(sec)}
                        className={`py-2 rounded-lg border-2 text-xs font-bold transition ${
                          durationSec === sec
                            ? 'bg-[#FF6F0F]/15 border-[#FF6F0F] text-primary'
                            : 'bg-fill-subtle border-border-subtle text-muted hover:border-border-main'
                        }`}
                      >
                        {sec}초
                        {sec === 20 && <span className="block text-[8px] opacity-60">기본</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 파형 스타일 */}
                <div>
                  <p className="text-xs text-muted mb-2">파형 디자인</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {([
                      { id: 'bar',    label: 'Bar',    icon: '▐▌▐▌▐' },
                      { id: 'mirror', label: 'Mirror', icon: '≡≡≡' },
                      { id: 'wave',   label: 'Wave',   icon: '〜〜〜' },
                      { id: 'circle', label: 'Circle', icon: '◉' },
                      { id: 'dots',   label: 'Dots',   icon: '···' },
                    ] as const).map(({ id, label, icon }) => (
                      <button
                        key={id}
                        onClick={() => setWaveformStyle(id)}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 transition text-center ${
                          waveformStyle === id
                            ? 'bg-[#FF6F0F]/15 border-[#FF6F0F] text-primary'
                            : 'bg-fill-subtle border-border-subtle text-muted hover:border-border-main'
                        }`}
                      >
                        <span className="text-sm leading-none">{icon}</span>
                        <span className="text-[9px] font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 커버 애니메이션 (이미지 전용) */}
                {!bgVideoPreviewUrl && (
                  <div>
                    <p className="text-xs text-muted mb-2">커버 애니메이션 <span className="text-dim">(이미지 전용)</span></p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { id: 'none',      label: 'OFF',    icon: '—'  },
                        { id: 'breathing', label: 'Breath', icon: '🌊' },
                        { id: 'beat',      label: 'Beat',   icon: '🥁' },
                        { id: 'vinyl',     label: 'Vinyl',  icon: '💿' },
                      ] as const).map(({ id, label, icon }) => (
                        <button key={id} onClick={() => setCoverAnimStyle(id)}
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 transition text-center ${
                            coverAnimStyle === id
                              ? 'bg-[#FF6F0F]/15 border-[#FF6F0F] text-primary'
                              : 'bg-fill-subtle border-border-subtle text-muted hover:border-border-main'
                          }`}>
                          <span className="text-sm leading-none">{icon}</span>
                          <span className="text-[9px] font-semibold">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 바이닐 배경 블러 슬라이더 */}
                {coverAnimStyle === 'vinyl' && !bgVideoPreviewUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-muted">배경 블러</p>
                      <span className="text-xs font-bold text-primary">{vinylBgBlur}</span>
                    </div>
                    <input
                      type="range" min={0} max={20} step={1}
                      value={vinylBgBlur}
                      onChange={e => setVinylBgBlur(Number(e.target.value))}
                      className="w-full accent-[#FF6F0F]"
                    />
                    <div className="flex justify-between text-[10px] text-dim mt-0.5">
                      <span>없음</span><span>강함</span>
                    </div>
                  </div>
                )}

                {/* 파티클 효과 */}
                <div>
                  <p className="text-xs text-muted mb-2">파티클 효과</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { id: 'none',    label: 'OFF',     icon: '—'  },
                      { id: 'sakura',  label: '벚꽃',    icon: '🌸' },
                      { id: 'bubbles', label: '비누방울', icon: '🫧' },
                      { id: 'hearts',  label: '하트',    icon: '💕' },
                      { id: 'stars',   label: '별빛',    icon: '✨' },
                      { id: 'rose',    label: '장미',    icon: '🌹' },
                      { id: 'snow',    label: '눈꽃',    icon: '❄️' },
                    ] as const).map(({ id, label, icon }) => (
                      <button key={id} onClick={() => setParticleStyle(id)}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 transition text-center ${
                          particleStyle === id
                            ? 'bg-[#FF6F0F]/15 border-[#FF6F0F] text-primary'
                            : 'bg-fill-subtle border-border-subtle text-muted hover:border-border-main'
                        }`}>
                        <span className="text-sm leading-none">{icon}</span>
                        <span className="text-[9px] font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── 클라이맥스 구간 설정 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">클라이맥스 구간 설정</p>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6F0F]/15 text-[#FF6F0F] text-xs font-semibold hover:bg-[#FF6F0F]/25 transition disabled:opacity-50"
                  >
                    {analyzing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} />
                    )}
                    자동 감지
                  </button>
                </div>
                <p className="text-[9px] text-[#FF6F0F]/40 font-mono text-right -mt-1">에너지 분석 알고리즘</p>

                {analyzed && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Sparkles size={13} className="text-green-400" />
                    <p className="text-xs text-green-400">
                      클라이맥스 구간이 감지되었습니다: {fmtSec(startSec)} 시작
                    </p>
                  </div>
                )}

                {/* 웨이브폼 에디터 */}
                {selected.audio_url && (
                  <WaveformEditor
                    audioUrl={selected.audio_url}
                    durationSec={selected.duration_sec}
                    startSec={startSec}
                    windowSec={durationSec}
                    onStartChange={(s) => { setStartSec(s); setAnalyzed(false); }}
                    onPlayStart={() => { if (player.isPlaying) player.pause(); setLiveStopToken(t => t + 1); }}
                    autoPlayOnSelect={autoPlayOnSelect}
                    stopToken={waveStopToken}
                  />
                )}

                <p className="text-[10px] text-muted">
                  * 웨이브폼을 클릭하거나 드래그해서 구간을 이동하세요.
                </p>
              </div>

              {/* ── 쿠폰 첨부 ── */}
              {coupons.length > 0 && (
                <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary">쿠폰 첨부</p>
                    {selectedCoupon && (
                      <button
                        onClick={() => setSelectedCoupon(null)}
                        className="text-xs text-dim hover:text-muted transition"
                      >
                        선택 해제
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted -mt-1">영상 하단에 쿠폰 카드가 표시됩니다.</p>
                  <div className="flex flex-col gap-1.5">
                    {coupons.map(c => {
                      const isSelected = selectedCoupon?.id === c.id;
                      const label = c.discount_type === 'percent'
                        ? `${c.discount_value}% 할인`
                        : `${c.discount_value.toLocaleString()}원 할인`;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCoupon(isSelected ? null : c)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition border ${
                            isSelected
                              ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/40'
                              : 'bg-fill-subtle border-border-subtle hover:border-border-main'
                          }`}
                        >
                          <span className="text-lg shrink-0">🎟</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-primary truncate">{c.title}</p>
                            <p className="text-[10px] text-[#FF9F4F]">{label}</p>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-[#FF6F0F] flex items-center justify-center shrink-0">
                              <Check size={9} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 도입부 안내방송 ── */}
              {announcements.length > 0 && (
                <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary">도입부 안내방송</p>
                    {selectedAnn && (
                      <button
                        onClick={() => handleSelectAnn(null)}
                        className="text-xs text-dim hover:text-muted transition"
                      >
                        선택 해제
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted -mt-1">
                    선택한 안내방송이 영상 도입부에 재생되고, 음원은 자동으로 덕킹됩니다.
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {announcements.map(ann => {
                      const isSelected = selectedAnn?.id === ann.id;
                      return (
                        <button
                          key={ann.id}
                          onClick={() => handleSelectAnn(isSelected ? null : ann)}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition border ${
                            isSelected
                              ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/40'
                              : 'bg-fill-subtle border-border-subtle hover:border-border-main'
                          }`}
                        >
                          <span className="text-base shrink-0 mt-0.5">🔊</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-primary line-clamp-2 leading-snug">{ann.text}</p>
                            <p className="text-[10px] text-muted mt-0.5">
                              {ann.voice_type || 'AI 음성'} · {new Date(ann.created_at).toLocaleDateString('ko-KR')}
                              {isSelected && annDuration > 0 && ` · ${annDuration.toFixed(1)}초`}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-[#FF6F0F] flex items-center justify-center shrink-0 mt-0.5">
                              <Check size={9} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}


              {/* ── 요소 위치 조정 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">요소 위치 조정</p>
                  <button
                    onClick={() => { setHeaderTop(11); setInfoTop(72); setCouponTop(60); }}
                    className="text-xs text-dim hover:text-muted transition flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> 초기화
                  </button>
                </div>
                {[
                  { label: '제목 / 강조 문구', value: headerTop, set: setHeaderTop, show: !!(shortsTitle || shortsTagline) },
                  { label: '쿠폰 카드', value: couponTop, set: setCouponTop, show: !!selectedCoupon },
                  { label: '곡 정보 (제목·아티스트)', value: infoTop, set: setInfoTop, show: true },
                ].map(({ label, value, set, show }) => (
                  <div key={label} className={show ? '' : 'opacity-30 pointer-events-none'}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-muted">{label}</label>
                      <span className="text-xs font-semibold text-primary tabular-nums">{value}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={1}
                      value={value}
                      onChange={e => set(Number(e.target.value))}
                      className="w-full accent-[#FF6F0F]"
                    />
                    <div className="flex justify-between text-[10px] text-dim mt-0.5">
                      <span>상단</span>
                      <span>하단</span>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-dim">미리보기 썸네일에 즉시 반영됩니다.</p>
              </div>

              {/* ── 생성 버튼 & 결과 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">숏폼 생성</p>
                    <p className="text-xs text-muted mt-0.5">
                      Remotion으로 서버사이드 렌더링됩니다 (수 분 소요)
                    </p>
                  </div>
                  <button
                    onClick={handleRender}
                    disabled={rendering}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6F0F] text-white text-sm font-bold hover:bg-[#e86200] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rendering ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Film size={15} />
                        숏폼 생성
                      </>
                    )}
                  </button>
                </div>

                {/* 렌더링 중 안내 */}
                {rendering && (
                  <div className="rounded-lg bg-[#FF6F0F]/10 border border-[#FF6F0F]/20 px-4 py-3 flex gap-3 items-start">
                    <Loader2 size={15} className="animate-spin text-[#FF6F0F] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-[#FF9F4F] font-medium">렌더링 진행 중</p>
                      <p className="text-xs text-muted mt-0.5">
                        Remotion이 {durationSec * 30} 프레임을 렌더링하고 있습니다. 창을 닫지 마세요.
                      </p>
                    </div>
                  </div>
                )}

                {/* 에러 */}
                {renderError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                    <p className="text-sm text-red-400 font-medium">렌더링 실패</p>
                    <p className="text-xs text-muted mt-0.5 break-all">{renderError}</p>
                  </div>
                )}

                {/* 완료 */}
                {videoUrl && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-green-400" />
                      <p className="text-sm text-green-400 font-semibold">숏폼 영상이 생성되었습니다!</p>
                    </div>
                    {/* 영상 미리보기 */}
                    <video
                      src={videoUrl}
                      controls
                      className="rounded-lg w-full max-w-xs mx-auto"
                      style={{ aspectRatio: '9/16' }}
                    />
                    <div className="flex gap-2">
                      <a
                        href={videoUrl}
                        download={`shorts_${selected.title}.mp4`}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF6F0F] text-white text-sm font-semibold hover:bg-[#e86200] transition"
                      >
                        <Download size={14} />
                        다운로드
                      </a>
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 text-muted text-sm hover:bg-white/10 transition border border-border-main"
                      >
                        <ExternalLink size={14} />
                        새 탭
                      </a>
                    </div>

                    {/* 릴스 공유 */}
                    <div className="space-y-2 mt-3 pt-3 border-t border-border-subtle">
                      <p className="text-[10px] text-dim font-semibold">📱 인스타그램 릴스 공유</p>

                      {/* 캡션 복사 */}
                      <button
                        onClick={() => {
                          const genre = (selected.mood_tags ?? [])[0]?.replace(/[^a-zA-Z0-9가-힣]/g, '');
                          const tags = [
                            genre ? `#${genre}` : '',
                            '#매장BGM',
                            '#카페음악',
                            '#언니픽',
                          ].filter(Boolean).slice(0, 4).join(' ');
                          const caption = `🎵 ${selected.title}\n\n${tags}`;
                          navigator.clipboard.writeText(caption);
                          setCaptionCopied(true);
                          setTimeout(() => setCaptionCopied(false), 2000);
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition border ${
                          captionCopied
                            ? 'bg-green-500/15 border-green-500/30 text-green-400'
                            : 'bg-white/5 border-border-main text-muted hover:text-primary hover:bg-white/10'
                        }`}>
                        {captionCopied ? <><Check size={12} /> 캡션 복사됨!</> : <><Copy size={12} /> 릴스 캡션 복사</>}
                      </button>

                      {/* 모바일 공유 (Web Share API) */}
                      {'share' in navigator && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(videoUrl);
                              const blob = await res.blob();
                              const file = new File([blob], `${selected.title}_shorts.mp4`, { type: 'video/mp4' });
                              await navigator.share({ title: selected.title, files: [file] });
                            } catch {}
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30 transition">
                          <Share2 size={12} /> 모바일 공유 (인스타/틱톡)
                        </button>
                      )}

                      <p className="text-[8px] text-dim text-center">다운로드 → 인스타그램 앱 → 릴스 → 영상 선택 → 캡션 붙여넣기</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* ── 4단: 미리보기 패널 ── */}
        <div className="min-w-[200px] w-[22vw] max-w-[420px] shrink overflow-y-auto p-4 flex flex-col gap-4">
          {selected ? (
            <>
              {/* 제목 + 가이드/크게 보기 버튼 */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Film size={14} className="text-[#FF6F0F]" /> 미리보기
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleGuide}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${showGuide ? 'bg-white/10 text-primary' : 'text-muted hover:text-primary hover:bg-white/5'}`}
                    title="안전 영역 가이드"
                  >
                    <span className="text-[10px]">⊞</span> 가이드
                  </button>
                  <button
                    onClick={() => setPreviewExpanded(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted hover:text-primary hover:bg-white/5 transition"
                    title="크게 보기"
                  >
                    <Maximize2 size={13} /> 크게 보기
                  </button>
                </div>
              </div>

              {/* 라이브 미리보기 */}
              <LivePreviewFrame
                audioUrl={selected.audio_url}
                coverUrl={coverPreviewUrl ?? selected.cover_image_url}
                coverEmoji={selected.cover_emoji}
                bgVideoUrl={bgVideoPreviewUrl}
                startSec={startSec}
                durationSec={durationSec}
                shortsTitle={shortsTitle}
                shortsTagline={shortsTagline}
                selectedCoupon={selectedCoupon}
                trackTitle={selected.title}
                artist={selected.artist}
                headerTop={headerTop}
                infoTop={infoTop}
                couponTop={couponTop}
                waveformStyle={waveformStyle}
                coverAnimStyle={coverAnimStyle}
                particleStyle={particleStyle}
                bpm={selected?.bpm ?? 120}
                vinylBgBlur={vinylBgBlur}
                vinylPosX={vinylPosX}
                vinylPosY={vinylPosY}
                onVinylPosChange={(x, y) => { setVinylPosX(x); setVinylPosY(y); }}
                showGuide={showGuide}
                onPlayStart={() => { if (player.isPlaying) player.pause(); setWaveStopToken(t => t + 1); }}
                stopToken={liveStopToken}
              />

              {/* 구성 정보 */}
              <div className="flex flex-col gap-1 text-[10px] text-muted border-t border-border-main pt-3">
                {[
                  ['해상도', '720×1280'],
                  ['길이', `${durationSec}초`],
                  ['시작', fmtSec(startSec)],
                  ['파형', waveformStyle],
                  ['코덱', 'H.264'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="text-primary font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {/* 이 트랙의 숏폼 영상 (세로 피드) */}
              {trackHistory.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-border-main pt-3">
                  <p className="text-[10px] font-semibold text-muted flex items-center gap-1">
                    <Film size={11} /> 이 트랙으로 만든 숏폼 ({trackHistory.length})
                  </p>
                  <div className="flex flex-col gap-4">
                    {trackHistory.map(h => (
                      <div key={h.id} className="flex flex-col gap-2">
                        <div
                          className="relative w-full rounded-xl overflow-hidden group cursor-pointer"
                          style={{ aspectRatio: '9/16' }}
                          onClick={() => openHistoryPlayer(h)}
                        >
                          <video
                            src={h.videoUrl}
                            className="w-full h-full object-cover"
                            muted playsInline
                            onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                            onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                              <Play size={16} className="text-black ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-0.5 text-[9px] text-white/70">
                            {new Date(h.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); toggleLike(h.id); }}
                            className="absolute bottom-3 right-3 flex flex-col items-center gap-0.5 transition-transform hover:scale-110 active:scale-95"
                          >
                            {(h.likeCount ?? 0) > 0 && (
                              <span className="text-[9px] text-white font-bold leading-none mb-0.5">{h.likeCount}</span>
                            )}
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${likedIds.has(h.id) ? 'bg-red-500/80' : 'bg-black/40 border border-white/20'}`}>
                              <Heart size={16} fill={likedIds.has(h.id) ? '#fff' : 'none'} color="#fff" />
                            </div>
                            <span className="text-[8px] text-white/70 font-semibold leading-none">좋아요</span>
                          </button>
                        </div>
                        <div className="flex gap-1.5 px-0.5">
                          <button
                            onClick={() => loadFromHistory(h)}
                            className="flex-1 py-1 rounded text-[10px] font-semibold border border-[#FF6F0F]/40 text-[#FF9F4F] hover:bg-[#FF6F0F]/10 transition">
                            <RotateCcw size={9} className="inline mr-0.5" /> 설정
                          </button>
                          <a
                            href={h.videoUrl}
                            download
                            className="flex-1 py-1 rounded text-[10px] font-semibold border border-border-subtle text-dim hover:text-primary hover:border-border-main transition text-center">
                            ↓ 저장
                          </a>
                          <button
                            onClick={() => { removeShortsHistory(h.id); setHistory(loadShortsHistory()); }}
                            className="flex-1 py-1 rounded text-[10px] font-semibold border border-border-subtle text-dim hover:text-red-400 hover:border-red-500/30 transition">
                            <Trash2 size={9} className="inline mr-0.5" /> 삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
              <Film size={28} className="text-muted" />
              <p className="text-xs text-muted text-center">트랙 선택 후<br/>미리보기가 표시됩니다</p>
            </div>
          )}

          {/* ── 생성 히스토리 ── */}
          {history.length > 0 && (
            <div className="bg-card border border-border-main rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-tertiary flex items-center gap-2">
                  <Film size={14} className="text-[#FF6F0F]" /> 생성 히스토리
                  <span className="text-dim font-normal">· {history.length}건</span>
                </h2>
                <button
                  onClick={() => { if (confirm('숏폼 히스토리를 모두 삭제할까요?')) { saveShortsHistory([]); setHistory([]); } }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-dim hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 size={11} /> 전체 삭제
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {history.map(h => (
                  <div key={h.id} className="flex flex-col gap-2">
                    <div
                      className="relative w-full rounded-xl overflow-hidden group cursor-pointer"
                      style={{ aspectRatio: '9/16' }}
                      onClick={() => openHistoryPlayer(h)}
                    >
                      <video
                        src={h.videoUrl}
                        className="w-full h-full object-cover"
                        muted playsInline
                        onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                        onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <Play size={18} className="text-black ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-0.5 text-[9px] text-white/70">
                        {new Date(h.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); toggleLike(h.id); }}
                        className="absolute bottom-3 right-3 flex flex-col items-center gap-0.5 transition-transform hover:scale-110 active:scale-95"
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${likedIds.has(h.id) ? 'bg-red-500/80' : 'bg-black/40 border border-white/20'}`}>
                          <Heart size={16} fill={likedIds.has(h.id) ? '#fff' : 'none'} color="#fff" />
                        </div>
                        <span className="text-[8px] text-white/70 font-semibold leading-none">좋아요</span>
                      </button>
                    </div>
                    <div className="px-1 space-y-1">
                      <p className="text-xs text-primary font-semibold truncate">{h.trackTitle}</p>
                      <p className="text-[10px] text-dim truncate">{h.artist}</p>
                      <div className="flex gap-1">
                        {h.durationSec && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-dim">{h.durationSec}초</span>
                        )}
                        {h.waveformStyle && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-dim capitalize">{h.waveformStyle}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { if (selected?.id === h.trackId) loadFromHistory(h); }}
                          title="설정 불러오기"
                          className={`flex-1 py-1 rounded text-[10px] font-semibold transition border ${selected?.id === h.trackId ? 'border-[#FF6F0F]/40 text-[#FF9F4F] hover:bg-[#FF6F0F]/10' : 'border-border-subtle text-dim opacity-40 cursor-not-allowed'}`}>
                          <RotateCcw size={9} className="inline mr-0.5" /> 설정
                        </button>
                        <button
                          onClick={() => { removeShortsHistory(h.id); setHistory(loadShortsHistory()); }}
                          className="flex-1 py-1 rounded text-[10px] font-semibold border border-border-subtle text-dim hover:text-red-400 hover:border-red-500/30 transition">
                          <Trash2 size={9} className="inline mr-0.5" /> 삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── 미리보기 크게 보기 모달 ── */}
      {previewExpanded && selected && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewExpanded(false)}
        >
          <div
            className="relative flex flex-col items-center gap-4"
            style={{ height: 'min(90vh, 720px)', aspectRatio: '9/16' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setPreviewExpanded(false)}
              className="absolute -top-11 right-0 flex items-center gap-1.5 text-white/60 hover:text-white transition text-sm font-semibold"
            >
              <X size={16} /> 닫기
            </button>

            {/* 확대된 LivePreviewFrame */}
            <div className="w-full h-full">
              <LivePreviewFrame
                audioUrl={selected.audio_url}
                coverUrl={coverPreviewUrl ?? selected.cover_image_url}
                coverEmoji={selected.cover_emoji}
                bgVideoUrl={bgVideoPreviewUrl}
                startSec={startSec}
                durationSec={durationSec}
                shortsTitle={shortsTitle}
                shortsTagline={shortsTagline}
                selectedCoupon={selectedCoupon}
                trackTitle={selected.title}
                artist={selected.artist}
                headerTop={headerTop}
                infoTop={infoTop}
                couponTop={couponTop}
                waveformStyle={waveformStyle}
                coverAnimStyle={coverAnimStyle}
                particleStyle={particleStyle}
                bpm={selected?.bpm ?? 120}
                vinylBgBlur={vinylBgBlur}
                vinylPosX={vinylPosX}
                vinylPosY={vinylPosY}
                onVinylPosChange={(x, y) => { setVinylPosX(x); setVinylPosY(y); }}
                showGuide={showGuide}
                onPlayStart={() => { if (player.isPlaying) player.pause(); setWaveStopToken(t => t + 1); }}
                stopToken={liveStopToken}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 히스토리 영상 플레이 모달 ── */}
      {playingHistory && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => closeHistoryPlayer()}
        >
          <div
            className="relative flex flex-col items-center gap-3 max-h-full"
            onClick={e => e.stopPropagation()}
          >
            {/* 닫기 */}
            <button
              onClick={() => closeHistoryPlayer()}
              className="absolute -top-10 right-0 text-white/60 hover:text-white transition text-sm font-semibold flex items-center gap-1"
            >
              ✕ 닫기
            </button>

            {/* 영상 */}
            <video
              key={playingHistory.id}
              src={playingHistory.videoUrl}
              controls
              autoPlay
              className="rounded-2xl shadow-2xl"
              style={{ maxHeight: 'calc(100vh - 120px)', aspectRatio: '9/16', width: 'auto' }}
            />

            {/* 하단 액션 */}
            <div className="flex gap-2">
              <a
                href={playingHistory.videoUrl}
                download={`shorts_${playingHistory.trackTitle}.mp4`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6F0F] text-white text-xs font-bold hover:bg-[#e86200] transition"
              >
                <Download size={13} /> 다운로드
              </a>
              <a
                href={playingHistory.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition border border-white/20"
              >
                <ExternalLink size={13} /> 새 탭
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function ShortsPage() {
  return (
    <Suspense>
      <ShortsPageInner />
    </Suspense>
  );
}
