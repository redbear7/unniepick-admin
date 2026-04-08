'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { usePlayer } from '@/contexts/PlayerContext';
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
  Clock,
  Share2,
  Copy,
  Check,
  ImageIcon,
  RotateCcw,
  Maximize2,
  X,
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

// ─── 쇼츠 히스토리 (로컬 저장) ──────────────────────────────────
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
}: {
  audioUrl: string;
  durationSec: number;
  startSec: number;
  windowSec: number;
  onStartChange: (s: number) => void;
  onPlayStart?: () => void;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const dragging     = useRef(false);
  const lastSec      = useRef(0);

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
    const sec = secFromX(e.clientX);
    lastSec.current = sec;
    const ns = Math.max(0, Math.min(sec - windowSec / 2, durationSec - windowSec));
    onStartChange(Math.round(ns));
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
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

  // Stop playback on section change
  useEffect(() => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      cancelAnimationFrame(animFrameRef.current);
      setPlaying(false); setPlayPos(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSec]);

  useEffect(() => () => cancelAnimationFrame(animFrameRef.current), []);

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
  onPlayStart?: () => void;
}

function LivePreviewFrame({
  audioUrl, coverUrl, coverEmoji, bgVideoUrl,
  startSec, durationSec,
  shortsTitle, shortsTagline, selectedCoupon,
  trackTitle, artist,
  headerTop, infoTop, couponTop,
  onPlayStart,
}: LivePreviewFrameProps) {
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const animRef     = useRef<number>(0);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0); // 0~1
  const [wavePhase, setWavePhase] = useState(0);

  // Animated waveform bars on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 150;
    const H = canvas.offsetHeight || 24;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const bars = 24;
    const bw   = W / bars;
    const mid  = H / 2;
    for (let i = 0; i < bars; i++) {
      const amp = playing
        ? Math.max(0.15, Math.abs(Math.sin((wavePhase + i * 0.55) * 1.3)) * 0.85)
        : 0.18;
      const h = amp * H * 0.85;
      ctx.fillStyle = playing ? `rgba(255,111,15,${0.4 + amp * 0.6})` : 'rgba(255,255,255,0.18)';
      ctx.fillRect(i * bw + 1, mid - h / 2, Math.max(bw - 2, 1), h);
    }
  }, [playing, wavePhase]);

  // Animate wavePhase while playing
  useEffect(() => {
    if (!playing) return;
    let phase = wavePhase;
    const tick = () => {
      phase += 0.12;
      setWavePhase(phase);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Stop on startSec change
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
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <p className="text-[10px] text-dim">라이브 미리보기</p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* 9:16 프레임 */}
      <div
        className="relative rounded-xl overflow-hidden w-full"
        style={{ aspectRatio: '9/16', background: '#111' }}
      >
        {/* 배경: 동영상 or 커버 이미지 */}
        {bgVideoUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={bgVideoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            muted loop autoPlay playsInline
          />
        ) : coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl bg-[#1a1a2e]">{coverEmoji}</div>
        )}

        {/* 그라디언트 오버레이 */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.05) 45%,rgba(0,0,0,0.75) 100%)' }} />

        {/* 제목 / 강조 문구 */}
        <div className="absolute left-3 right-3" style={{ top: `${headerTop}%` }}>
          {shortsTitle   && <p className="text-white text-[9px] font-black leading-tight line-clamp-2">{shortsTitle}</p>}
          {shortsTagline && <p className="text-[#FF9F4F] text-[8px] font-bold mt-0.5 truncate">{shortsTagline}</p>}
        </div>

        {/* 쿠폰 */}
        {selectedCoupon && (
          <div className="absolute left-3 right-3" style={{ top: `${couponTop}%` }}>
            <div className="bg-[#FF6F0F]/90 rounded-lg px-2 py-1 flex items-center gap-1.5">
              <span className="text-sm">🎟</span>
              <div className="min-w-0">
                <p className="text-white text-[7px] font-semibold truncate">{selectedCoupon.title}</p>
                <p className="text-white text-[8px] font-black">
                  {selectedCoupon.discount_type === 'percent'
                    ? `${selectedCoupon.discount_value}% 할인`
                    : `${selectedCoupon.discount_value.toLocaleString()}원 할인`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 곡 정보 */}
        <div className="absolute left-3 right-3" style={{ top: `${infoTop}%` }}>
          <p className="text-white text-[8px] font-semibold leading-tight truncate">🎵 {trackTitle}</p>
          <p className="text-white/60 text-[7px] truncate mt-0.5">{artist}</p>
        </div>

        {/* 언니픽 배지 */}
        <div className="absolute top-2 right-2 bg-[#FF6F0F]/90 rounded text-white text-[6px] font-bold px-1 py-0.5">언니픽</div>



        {/* 파형 */}
        <div className="absolute bottom-8 left-3 right-3">
          <canvas ref={canvasRef} className="w-full block" style={{ height: 24 }} />
        </div>

        {/* 진행 바 */}
        <div className="absolute bottom-4 left-3 right-3 h-0.5 bg-white/15 rounded">
          <div
            className="h-full bg-[#FF6F0F] rounded transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* 시간 표시 */}
        <div className="absolute bottom-1 left-3 right-3 flex justify-between">
          <span className="text-[7px] font-mono text-white/50">{fmtSec(startSec + progress * durationSec)}</span>
          <span className="text-[7px] font-mono text-white/30">{fmtSec(startSec + durationSec)}</span>
        </div>

        {/* 재생 버튼 (중앙, hover 시 표시 or 항상) */}
        <button
          onClick={togglePlay}
          className={`absolute inset-0 flex items-center justify-center transition ${playing ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition ${playing ? 'bg-black/40' : 'bg-black/50 hover:bg-black/70'}`}>
            {playing
              ? <Pause size={16} className="text-white" />
              : <Play  size={16} className="text-white ml-0.5" />}
          </div>
        </button>
      </div>

      {/* 구간 표시 */}
      <p className="text-[9px] font-mono text-dim">
        {fmtSec(startSec)} ~ {fmtSec(startSec + durationSec)}
        <span className="text-[#FF6F0F]/60 ml-1">({durationSec}초)</span>
      </p>
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────
export default function ShortsPage() {
  const sb = createClient();
  const player = usePlayer();

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

  // 쇼츠 제목 / 강조 문구
  const [shortsTitle, setShortsTitle] = useState('');
  const [shortsTagline, setShortsTagline] = useState('');

  // 오디오 페이드인 / 파형 스타일
  const [audioFadeInSec, setAudioFadeInSec] = useState(1.5);
  const [waveformStyle, setWaveformStyle] = useState<'bar' | 'mirror' | 'wave' | 'circle' | 'dots'>('bar');
  const [durationSec, setDurationSec] = useState(20);

  // 요소 위치 (% from top)
  const [headerTop, setHeaderTop] = useState(8);
  const [infoTop, setInfoTop] = useState(72);
  const [couponTop, setCouponTop] = useState(62);

  // 렌더링
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [captionCopied, setCaptionCopied] = useState(false);

  // 히스토리
  const [history, setHistory] = useState<ShortsHistoryItem[]>([]);
  const [playingHistory, setPlayingHistory] = useState<ShortsHistoryItem | null>(null);
  const wasPlayingRef = useRef(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
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

  // ── 쇼츠 렌더링 요청 ──
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



  // 현재 선택 트랙의 기존 쇼츠 필터
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
        <div>
          <h1 className="text-lg font-bold text-primary">쇼츠 영상 생성</h1>
          <p className="text-xs text-muted mt-0.5">
            음악 트랙에서 클라이맥스 구간을 추출해 9:16 쇼츠 영상(30초)을 생성합니다.
          </p>
        </div>
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
                    {(selected.mood_tags ?? []).slice(0, 5).map((tag) => (
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

              {/* ── 이 트랙의 기존 쇼츠 ── */}
              {trackHistory.length > 0 && (
                <div className="bg-card border border-[#FF6F0F]/30 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      <Film size={14} className="text-[#FF6F0F]" />
                      이 트랙의 쇼츠 영상
                      <span className="text-xs font-normal text-muted">{trackHistory.length}개</span>
                    </p>
                  </div>
                  <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                    {trackHistory.map(h => (
                      <div key={h.id} className="shrink-0 w-28 flex flex-col gap-1.5">
                        {/* 썸네일 + 플레이 */}
                        <div
                          className="relative rounded-lg overflow-hidden cursor-pointer group bg-black"
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
                            <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                              <Play size={14} className="text-black ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 text-center space-y-0.5">
                            {h.storeName && (
                              <span className="block text-[8px] text-white/80 bg-[#FF6F0F]/70 rounded px-1 truncate">
                                {h.storeName}
                              </span>
                            )}
                            <span className="block text-[8px] text-white/60 bg-black/50 rounded px-1">
                              {new Date(h.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        {/* 버튼들 */}
                        <button
                          onClick={() => loadFromHistory(h)}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#FF6F0F]/15 text-[#FF9F4F] text-[10px] font-semibold hover:bg-[#FF6F0F]/25 transition"
                        >
                          <RotateCcw size={10} /> 설정 불러오기
                        </button>
                        <div className="flex gap-1">
                          <a
                            href={h.videoUrl}
                            download={`shorts_${h.trackTitle}.mp4`}
                            className="flex-1 flex items-center justify-center py-1 rounded-lg bg-white/5 text-muted text-[10px] hover:bg-white/10 transition"
                          >
                            <Download size={10} />
                          </a>
                          <button
                            onClick={() => { removeShortsHistory(h.id); setHistory(loadShortsHistory()); }}
                            className="flex-1 flex items-center justify-center py-1 rounded-lg bg-white/5 text-muted text-[10px] hover:text-red-400 hover:bg-red-500/10 transition"
                          >
                            <Trash2 size={10} />
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

              {/* ── 쇼츠 제목 / 강조 문구 ── */}
              <div className="bg-card border border-border-main rounded-xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-primary">영상 텍스트</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted mb-1 block">쇼츠 제목 (상단 큰 텍스트)</label>
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
                    onPlayStart={() => { if (player.isPlaying) player.pause(); }}
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
                    onClick={() => { setHeaderTop(8); setInfoTop(72); setCouponTop(62); }}
                    className="text-xs text-dim hover:text-muted transition flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> 초기화
                  </button>
                </div>
                {[
                  { label: '제목 / 강조 문구', value: headerTop, set: setHeaderTop, show: !!(shortsTitle || shortsTagline) },
                  { label: '곡 정보 (제목·아티스트)', value: infoTop, set: setInfoTop, show: true },
                  { label: '쿠폰 카드', value: couponTop, set: setCouponTop, show: !!selectedCoupon },
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
                    <p className="text-sm font-semibold text-primary">쇼츠 생성</p>
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
                        쇼츠 생성
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
                      <p className="text-sm text-green-400 font-semibold">쇼츠 영상이 생성되었습니다!</p>
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

          {/* ── 히스토리 (오른쪽 패널 하단) ── */}
          {history.length > 0 && (
            <div className="bg-card border border-border-main rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-tertiary flex items-center gap-2">
                  <Clock size={14} /> 생성 히스토리
                  <span className="text-dim font-normal">· {history.length}건 · 로컬 저장</span>
                </h2>
                <button
                  onClick={() => { if (confirm('쇼츠 히스토리를 모두 삭제할까요?')) { saveShortsHistory([]); setHistory([]); } }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-dim hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 size={11} /> 전체 삭제
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                {history.map(h => (
                  <div key={h.id} className="shrink-0 w-36 bg-fill-subtle border border-border-subtle rounded-xl overflow-hidden group">
                    <div
                      className="relative aspect-[9/16] cursor-pointer"
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
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-[10px] text-primary font-semibold truncate">{h.trackTitle}</p>
                      <p className="text-[9px] text-dim truncate">{h.artist}</p>
                      {h.storeName && (
                        <p className="text-[9px] text-[#FF9F4F] truncate">🏪 {h.storeName}</p>
                      )}
                      <div className="flex gap-1">
                        {h.durationSec && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-dim">{h.durationSec}초</span>
                        )}
                        {h.waveformStyle && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-dim capitalize">{h.waveformStyle}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] text-dim">
                          {new Date(h.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { if (selected?.id === h.trackId) loadFromHistory(h); }}
                            title="설정 불러오기"
                            className={`p-0.5 transition ${selected?.id === h.trackId ? 'text-[#FF6F0F] hover:text-[#FF9F4F]' : 'text-dim opacity-30 cursor-not-allowed'}`}>
                            <RotateCcw size={9} />
                          </button>
                          <button
                            onClick={() => { removeShortsHistory(h.id); setHistory(loadShortsHistory()); }}
                            className="text-dim hover:text-red-400 transition p-0.5">
                            <Trash2 size={9} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 4단: 미리보기 패널 ── */}
        <div className="w-[300px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4">
          {selected ? (
            <>
              {/* 제목 + 크게 보기 버튼 */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Film size={14} className="text-[#FF6F0F]" /> 미리보기
                </p>
                <button
                  onClick={() => setPreviewExpanded(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted hover:text-primary hover:bg-white/5 transition"
                  title="크게 보기"
                >
                  <Maximize2 size={13} /> 크게 보기
                </button>
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
                onPlayStart={() => { if (player.isPlaying) player.pause(); }}
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
              <Film size={28} className="text-muted" />
              <p className="text-xs text-muted text-center">트랙 선택 후<br/>미리보기가 표시됩니다</p>
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
                onPlayStart={() => { if (player.isPlaying) player.pause(); }}
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
