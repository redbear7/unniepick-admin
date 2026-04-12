import React from 'react';
import {
  AbsoluteFill, Audio, Img, OffthreadVideo,
  interpolate, useCurrentFrame, useVideoConfig, Loop,
} from 'remotion';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type WaveformStyle  = 'bar' | 'mirror' | 'wave' | 'circle' | 'dots';
export type CoverAnimStyle = 'none' | 'breathing' | 'beat' | 'vinyl';
export type ParticleStyle  = 'none' | 'sakura' | 'bubbles' | 'hearts' | 'stars' | 'rose' | 'snow';

interface CouponData {
  title: string;
  discount_type: 'percent' | 'fixed' | string;
  discount_value: number;
}

interface ElementPositions {
  headerTop?: number;
  infoTop?: number;
  couponTop?: number;
}

interface ShortsVideoProps {
  audioUrl: string;
  coverUrl: string | null;
  bgVideoUrl?: string | null;
  bgVideoDurationSec?: number;
  title: string;
  artist: string;
  coverEmoji: string;
  startTimeSec: number;
  moodTags: string[];
  shortsTitle?: string;
  shortsTagline?: string;
  coupon?: CouponData | null;
  announcementUrl?: string;
  announcementDurationSec?: number;
  elementPositions?: ElementPositions;
  audioFadeInSec?: number;
  waveformStyle?: WaveformStyle;
  coverAnimStyle?: CoverAnimStyle;
  particleStyle?: ParticleStyle;
  bpm?: number;
  vinylPosX?: number;
  vinylPosY?: number;
  vinylBgBlur?: number;
}

/* ------------------------------------------------------------------ */
/* Seeded pseudo-random (deterministic, no Math.random)                */
/* ------------------------------------------------------------------ */

function sr(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* Waveform                                                            */
/* ------------------------------------------------------------------ */

function Waveform({ style, frame, beatAmp = 0 }: { style: WaveformStyle; frame: number; beatAmp?: number }) {
  const COUNT = 20;
  const C = 'rgba(255,111,15,';
  const boost = 1 + beatAmp * 0.55;

  const amps = Array.from({ length: COUNT }, (_, i) => {
    const phase = (i / COUNT) * Math.PI * 2;
    return Math.min(1, Math.abs(Math.sin(frame / 10 + phase)) * boost);
  });

  if (style === 'bar') {
    const bars = amps.map(a => a * 50 + 16);
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52, marginBottom: 16 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 5, height: h, borderRadius: 3, background: `${C}${0.45 + (h / 66) * 0.55})` }} />
        ))}
      </div>
    );
  }

  if (style === 'mirror') {
    const bars = amps.map(a => a * 22 + 6);
    return (
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 52, marginBottom: 16 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 4, height: h, borderRadius: 2, background: `${C}${0.5 + amps[i] * 0.5})` }} />
            <div style={{ width: 4, height: h, borderRadius: 2, background: `${C}${0.3 + amps[i] * 0.4})` }} />
          </div>
        ))}
      </div>
    );
  }

  if (style === 'wave') {
    const W = 616; const H = 52;
    const pts = Array.from({ length: COUNT * 2 + 1 }, (_, i) => {
      const x = (i / (COUNT * 2)) * W;
      const amp = Math.abs(Math.sin(frame / 10 + (i / (COUNT * 2)) * Math.PI * 2)) * (H * 0.38 * boost);
      return `${x},${H / 2 - amp}`;
    }).join(' ');
    const pts2 = Array.from({ length: COUNT * 2 + 1 }, (_, i) => {
      const x = ((COUNT * 2 - i) / (COUNT * 2)) * W;
      const amp = Math.abs(Math.sin(frame / 10 + ((COUNT * 2 - i) / (COUNT * 2)) * Math.PI * 2)) * (H * 0.38 * boost);
      return `${x},${H / 2 + amp}`;
    }).join(' ');
    return (
      <svg width={W} height={H} style={{ marginBottom: 16, display: 'block' }}>
        <defs>
          <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#FF6F0F" stopOpacity="0.3" />
            <stop offset="50%"  stopColor="#FF6F0F" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FF6F0F" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <polygon points={`${pts} ${pts2}`} fill="url(#wg)" />
        <polyline points={pts} fill="none" stroke="#FF6F0F" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (style === 'circle') {
    const R = 22; const CX = COUNT * 3.5; const CY = 26;
    return (
      <svg width={CX * 2} height={52} style={{ marginBottom: 16, display: 'block' }}>
        {amps.map((a, i) => {
          const angle = (i / COUNT) * Math.PI;
          const r = R + a * 14 * (1 + beatAmp * 0.3);
          const x = CX + Math.cos(Math.PI - angle) * r;
          const y = CY - Math.sin(angle) * r * 0.7;
          return <circle key={i} cx={x} cy={y} r={3 + a * 4} fill={`${C}${0.4 + a * 0.6})`} />;
        })}
        <circle cx={CX} cy={CY} r={4 + Math.abs(Math.sin(frame / 8)) * 6 * (1 + beatAmp * 0.5)}
          fill="none" stroke={`${C}0.5)`} strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 52, marginBottom: 16 }}>
      {amps.map((a, i) => {
        const size = 4 + a * 12 * (1 + beatAmp * 0.3);
        return <div key={i} style={{ width: size, height: size, borderRadius: '50%', background: `${C}${0.4 + a * 0.6})`, flexShrink: 0 }} />;
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Particle Layer                                                      */
/* ------------------------------------------------------------------ */

function ParticleLayer({ type, frame }: { type: ParticleStyle; frame: number }) {
  if (type === 'none') return null;

  const W = 720, H = 1280;
  const nodes: React.ReactNode[] = [];

  /* ── Sakura / Rose petals (falling) ── */
  if (type === 'sakura' || type === 'rose') {
    const N = 20;
    for (let i = 0; i < N; i++) {
      const speed  = 1.0 + sr(i, 0) * 1.8;
      const startX = sr(i, 1) * W;
      const pw     = (type === 'rose' ? 9 : 12) + sr(i, 2) * (type === 'rose' ? 10 : 16);
      const ph     = pw * (0.5 + sr(i, 3) * 0.4);
      const sway   = 28 + sr(i, 4) * 44;
      const freq   = 0.017 + sr(i, 5) * 0.024;
      const phase  = sr(i, 6) * 700;
      const op     = 0.5 + sr(i, 7) * 0.4;
      const t      = (frame + phase) % (H / speed);
      const y      = t * speed;
      const x      = startX + Math.sin(frame * freq + sr(i, 8) * Math.PI * 2) * sway;
      const angle  = (frame * (1.2 + sr(i, 9) * 2.5)) % 360;
      const hue    = type === 'rose' ? 330 + sr(i, 10) * 20 : 338 + sr(i, 10) * 16;
      const sat    = type === 'rose' ? 72 : 60;
      const light  = type === 'rose' ? 65 : 82;
      nodes.push(
        <ellipse key={i} cx={x} cy={y} rx={pw / 2} ry={ph / 2}
          fill={`hsla(${hue},${sat}%,${light}%,${op})`}
          transform={`rotate(${angle} ${x} ${y})`} />,
      );
    }
  }

  /* ── Bubbles (floating up) ── */
  if (type === 'bubbles') {
    const N = 13;
    for (let i = 0; i < N; i++) {
      const speed  = 0.45 + sr(i, 0) * 0.9;
      const startX = sr(i, 1) * W;
      const r      = 10 + sr(i, 2) * 30;
      const sway   = 12 + sr(i, 3) * 28;
      const freq   = 0.017 + sr(i, 4) * 0.018;
      const phase  = sr(i, 5) * 900;
      const op     = 0.28 + sr(i, 6) * 0.32;
      const t      = (frame + phase) % (H / speed);
      const y      = H - t * speed;
      const x      = startX + Math.sin(frame * freq + sr(i, 7) * Math.PI * 2) * sway;
      const hue    = (frame * 0.55 + i * 27.3) % 360;
      const hue2   = (hue + 120) % 360;
      const gId    = `bg${i}`;
      nodes.push(
        <g key={i}>
          <defs>
            <radialGradient id={gId} cx="35%" cy="35%" r="65%">
              <stop offset="0%"   stopColor={`hsla(${hue2},80%,90%,0.15)`} />
              <stop offset="100%" stopColor={`hsla(${hue},60%,70%,0.04)`} />
            </radialGradient>
          </defs>
          <circle cx={x} cy={y} r={r}
            fill={`url(#${gId})`}
            stroke={`hsla(${hue},70%,85%,${op})`}
            strokeWidth={1.2} />
          <circle cx={x - r * 0.28} cy={y - r * 0.28} r={r * 0.2}
            fill={`rgba(255,255,255,${op * 0.8})`} />
        </g>,
      );
    }
  }

  /* ── Hearts (floating up) ── */
  if (type === 'hearts') {
    const N = 16;
    const hPath = 'M0,-6 C0,-10.5 -8,-10.5 -8,-5 C-8,-0.5 0,6.5 0,9 C0,6.5 8,-0.5 8,-5 C8,-10.5 0,-10.5 0,-6 Z';
    for (let i = 0; i < N; i++) {
      const speed  = 0.44 + sr(i, 0) * 0.75;
      const startX = sr(i, 1) * W;
      const scale  = 1.0 + sr(i, 2) * 2.0;
      const sway   = 18 + sr(i, 3) * 28;
      const freq   = 0.021 + sr(i, 4) * 0.018;
      const phase  = sr(i, 5) * 750;
      const op     = 0.5 + sr(i, 6) * 0.4;
      const t      = (frame + phase) % (H / speed);
      const y      = H - t * speed;
      const x      = startX + Math.sin(frame * freq + sr(i, 7) * Math.PI * 2) * sway;
      const bob    = Math.sin(frame * 0.11 + sr(i, 8) * Math.PI * 2) * 6;
      const hue    = 318 + sr(i, 9) * 42;
      nodes.push(
        <path key={i} d={hPath}
          fill={`hsla(${hue},90%,72%,${op})`}
          transform={`translate(${x},${y + bob}) scale(${scale})`} />,
      );
    }
  }

  /* ── Stars / sparkles (twinkling in place) ── */
  if (type === 'stars') {
    const N = 24;
    for (let i = 0; i < N; i++) {
      const bx     = sr(i, 0) * W;
      const by     = sr(i, 1) * H;
      const r      = 5 + sr(i, 2) * 11;
      const tFreq  = 0.04 + sr(i, 3) * 0.09;
      const tPhase = sr(i, 4) * Math.PI * 2;
      const raw    = Math.sin(frame * tFreq + tPhase) * 0.5 + 0.5;
      const op     = Math.max(0.05, raw);
      const sc     = 0.6 + raw * 0.5;
      const drift  = 12 + sr(i, 5) * 18;
      const px     = bx + Math.sin(frame * 0.006 + sr(i, 6) * Math.PI * 2) * drift;
      const py     = by + Math.cos(frame * 0.006 + sr(i, 7) * Math.PI * 2) * drift * 0.6;
      const a = r, b = r * 0.28;
      const starPath = `M0,${-a} L${b},${-b} L${a},0 L${b},${b} L0,${a} L${-b},${b} L${-a},0 L${-b},${-b} Z`;
      const hue = 40 + sr(i, 8) * 25;
      nodes.push(
        <path key={i} d={starPath}
          fill={`hsla(${hue},100%,78%,${op})`}
          transform={`translate(${px},${py}) scale(${sc})`} />,
      );
    }
  }

  /* ── Snow (falling) ── */
  if (type === 'snow') {
    const N = 20;
    for (let i = 0; i < N; i++) {
      const speed  = 0.55 + sr(i, 0) * 0.85;
      const startX = sr(i, 1) * W;
      const r      = 7 + sr(i, 2) * 11;
      const sway   = 12 + sr(i, 3) * 22;
      const freq   = 0.012 + sr(i, 4) * 0.018;
      const phase  = sr(i, 5) * 650;
      const op     = 0.4 + sr(i, 6) * 0.45;
      const rotSpd = (sr(i, 7) - 0.5) * 1.2;
      const t      = (frame + phase) % (H / speed);
      const y      = t * speed;
      const x      = startX + Math.sin(frame * freq + sr(i, 8) * Math.PI * 2) * sway;
      const rot    = (frame * rotSpd + sr(i, 9) * 360) % 360;
      const arms   = Array.from({ length: 6 }, (_, k) => {
        const rad  = k * 60 * (Math.PI / 180);
        const ex = Math.cos(rad) * r; const ey = Math.sin(rad) * r;
        const mx = Math.cos(rad) * r * 0.5; const my = Math.sin(rad) * r * 0.5;
        const perp = rad + Math.PI / 2; const bLen = r * 0.28;
        return (
          <g key={k}>
            <line x1="0" y1="0" x2={ex} y2={ey} />
            <line x1={mx + Math.cos(perp) * bLen} y1={my + Math.sin(perp) * bLen}
                  x2={mx - Math.cos(perp) * bLen} y2={my - Math.sin(perp) * bLen} />
          </g>
        );
      });
      nodes.push(
        <g key={i} transform={`translate(${x},${y}) rotate(${rot})`}
          stroke={`rgba(215,230,255,${op})`} strokeWidth={1.3} strokeLinecap="round" fill="none">
          {arms}
        </g>,
      );
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        {nodes}
      </svg>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Vinyl Overlay (image mode only)                                     */
/* ------------------------------------------------------------------ */

function VinylOverlay({ frame, fps, coverUrl, coverEmoji, posX = 50, posY = 28 }: {
  frame: number; fps: number; coverUrl: string | null; coverEmoji: string;
  posX?: number; posY?: number; // % of 720×1280
}) {
  const rotDeg = (frame / fps) * 28;
  const DISC = 360;
  const ART  = 140;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: `${posX}%`, top: `${posY}%`, transform: 'translate(-50%, -50%)' }}>
      <div style={{ position: 'relative', width: DISC, height: DISC }}>
        {/* Outer disc */}
        <div style={{
          width: DISC, height: DISC, borderRadius: '50%',
          background: 'radial-gradient(circle, #242424 0%, #0d0d0d 70%, #050505 100%)',
          transform: `rotate(${rotDeg}deg)`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.85), 0 4px 24px rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Groove rings */}
          {Array.from({ length: 8 }, (_, k) => (
            <div key={k} style={{
              position: 'absolute',
              width: DISC - k * 32 - 10, height: DISC - k * 32 - 10,
              borderRadius: '50%',
              border: '0.5px solid rgba(255,255,255,0.045)',
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
            }} />
          ))}
          {/* Surface sheen */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%)',
          }} />
          {/* Cover art */}
          <div style={{ width: ART, height: ART, borderRadius: '50%', overflow: 'hidden', position: 'relative', zIndex: 2, flexShrink: 0 }}>
            {coverUrl ? (
              <Img src={coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#2a2a3a,#1a1a28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54 }}>
                {coverEmoji}
              </div>
            )}
          </div>
        </div>
        {/* Center hole */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 22, height: 22, borderRadius: '50%',
          background: '#020202',
          border: '2px solid rgba(255,255,255,0.12)',
          zIndex: 10,
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.9)',
        }} />
        {/* Center glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 32, height: 32, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,111,15,0.28) 0%, transparent 70%)',
          zIndex: 11,
        }} />
      </div>
      </div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export const ShortsVideo: React.FC<ShortsVideoProps> = ({
  audioUrl,
  coverUrl,
  bgVideoUrl,
  bgVideoDurationSec,
  title,
  artist,
  coverEmoji,
  startTimeSec,
  moodTags,
  shortsTitle,
  shortsTagline,
  coupon,
  announcementUrl,
  announcementDurationSec = 0,
  elementPositions,
  audioFadeInSec = 1.5,
  waveformStyle = 'bar',
  coverAnimStyle = 'none',
  particleStyle  = 'none',
  bpm = 120,
  vinylPosX = 50,
  vinylPosY = 28,
  vinylBgBlur = 14,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = frame / durationInFrames;

  // ── BPM 기반 beat / breathing 계산
  const safeBpm      = Math.max(40, Math.min(240, bpm || 120));
  const beatInterval = fps * 60 / safeBpm;           // frames per beat
  const beatPhase    = frame % beatInterval;
  // 빠른 어택, 1/4 비트 decay
  const beatAmp      = Math.max(0, 1 - beatPhase / (beatInterval * 0.25));
  // 호흡: 4비트마다 1사이클 (느린 sine)
  const breathPhase  = (frame % (beatInterval * 4)) / (beatInterval * 4) * Math.PI * 2;

  // ── Cover background transforms (image only)
  const isImageBg = !bgVideoUrl;
  const coverScale = isImageBg && coverAnimStyle === 'breathing'
    ? 1 + Math.sin(breathPhase) * 0.024
    : isImageBg && coverAnimStyle === 'beat'
    ? 1 + beatAmp * 0.036
    : 1;
  const coverBrightness = isImageBg && coverAnimStyle === 'beat'
    ? 1 + beatAmp * 0.14
    : isImageBg && coverAnimStyle === 'vinyl'
    ? 0.3
    : 1;
  const coverBlur = isImageBg && coverAnimStyle === 'vinyl' ? vinylBgBlur : 0;

  // ── Volume / fade
  const annFrames    = Math.ceil(announcementDurationSec * fps);
  const duckEnd      = annFrames + 30;
  const fadeInFrames = Math.max(1, Math.round(audioFadeInSec * fps));

  const musicVolume = annFrames > 0
    ? interpolate(frame, [0, annFrames, duckEnd], [0.12, 0.12, 1.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ── Entry animations
  const topOpacity    = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const topY          = interpolate(frame, [0, 20], [-24, 0], { extrapolateRight: 'clamp' });
  const bottomOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const bottomY       = interpolate(frame, [10, 30], [24, 0], { extrapolateRight: 'clamp' });

  // ── Coupon loop animation
  const couponStart = duckEnd + 15;
  const CYCLE       = 120;
  const loopFrame   = coupon && frame >= couponStart ? (frame - couponStart) % CYCLE : 0;
  const couponOpacity = coupon && frame >= couponStart
    ? interpolate(loopFrame, [0, 20, 100, 120], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const couponY = coupon && frame >= couponStart
    ? interpolate(loopFrame, [0, 20, 100, 120], [40, 0, 0, 40], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const couponScale = coupon && frame >= couponStart
    ? interpolate(loopFrame, [18, 24, 30], [0.95, 1.04, 1.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;

  // ── Element positions
  const VH         = 1280;
  const headerTopPx = ((elementPositions?.headerTop ?? 8)  / 100) * VH;
  const infoTopPx   = ((elementPositions?.infoTop   ?? 72) / 100) * VH;
  const couponTopPx = ((elementPositions?.couponTop  ?? 60) / 100) * VH;

  const discountLabel = coupon
    ? coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% 할인`
      : `${coupon.discount_value.toLocaleString()}원 할인`
    : '';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: 'sans-serif' }}>
      <Audio src={audioUrl} startFrom={Math.round(startTimeSec * fps)} volume={musicVolume} />
      {announcementUrl && <Audio src={announcementUrl} volume={1.0} />}

      {/* ── 배경 ── */}
      <AbsoluteFill>
        {bgVideoUrl ? (
          <Loop durationInFrames={bgVideoDurationSec ? Math.max(1, Math.round(bgVideoDurationSec * fps)) : durationInFrames}>
            <OffthreadVideo src={bgVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
          </Loop>
        ) : coverUrl ? (
          <div style={{
            width: '100%', height: '100%',
            transform: `scale(${coverScale})`,
            filter: `brightness(${coverBrightness})${coverBlur > 0 ? ` blur(${coverBlur}px)` : ''}`,
          }}>
            <Img src={coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(180deg,#1a1a2e 0%,#0f0f1a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 200,
            transform: `scale(${coverScale})`,
          }}>
            {coverEmoji}
          </div>
        )}
      </AbsoluteFill>

      {/* ── Vinyl disc overlay (image mode only) ── */}
      {isImageBg && coverAnimStyle === 'vinyl' && (
        <VinylOverlay frame={frame} fps={fps} coverUrl={coverUrl} coverEmoji={coverEmoji}
          posX={vinylPosX} posY={vinylPosY} />
      )}

      {/* ── 그라데이션 오버레이 ── */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.15) 52%, rgba(0,0,0,0.82) 100%)' }} />

      {/* ── 파티클 레이어 ── */}
      <ParticleLayer type={particleStyle} frame={frame} />

      {/* ── 상단: 쇼츠 제목 + 강조 문구 ── */}
      {(shortsTitle || shortsTagline) && (
        <div style={{ position: 'absolute', top: headerTopPx, left: 52, right: 52, opacity: topOpacity, transform: `translateY(${topY}px)` }}>
          {shortsTitle && (
            <div style={{ color: '#fff', fontSize: 68, fontWeight: 900, lineHeight: 1.15, textShadow: '0 3px 24px rgba(0,0,0,0.9)', letterSpacing: -1 }}>
              {shortsTitle}
            </div>
          )}
          {shortsTagline && (
            <div style={{ color: '#FF9F4F', fontSize: 30, fontWeight: 700, marginTop: 14, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
              {shortsTagline}
            </div>
          )}
        </div>
      )}

      {/* ── 쿠폰 카드 ── */}
      {coupon && (
        <div style={{ position: 'absolute', top: couponTopPx, left: 40, right: 40, opacity: couponOpacity, transform: `translateY(${couponY}px) scale(${couponScale})` }}>
          <div style={{ width: '100%', background: 'linear-gradient(135deg,rgba(255,111,15,0.95) 0%,rgba(255,80,0,0.95) 100%)', borderRadius: 24, padding: '22px 32px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 40px rgba(255,111,15,0.5)', border: '1.5px solid rgba(255,255,255,0.25)' }}>
            <div style={{ fontSize: 48 }}>🎟</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{coupon.title}</div>
              <div style={{ color: '#fff', fontSize: 38, fontWeight: 900, lineHeight: 1 }}>{discountLabel}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 14, padding: '10px 18px', color: '#fff', fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.3)' }}>
              앱에서 받기
            </div>
          </div>
        </div>
      )}

      {/* ── 곡 정보 + 파형 ── */}
      <div style={{ position: 'absolute', top: infoTopPx, left: 52, right: 52, opacity: bottomOpacity, transform: `translateY(${bottomY}px)` }}>
        <Waveform style={waveformStyle} frame={frame} beatAmp={coverAnimStyle === 'beat' ? beatAmp : 0} />
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, lineHeight: 1.3, textShadow: '0 2px 12px rgba(0,0,0,0.9)', maxWidth: 560 }}>
          🎵 {title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 22, fontWeight: 500, marginTop: 6, textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>
          {artist}
        </div>
        {moodTags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {moodTags.slice(0, 3).map(tag => (
              <div key={tag} style={{ background: 'rgba(255,111,15,0.28)', border: '1px solid rgba(255,111,15,0.45)', borderRadius: 20, padding: '3px 13px', fontSize: 18, color: '#FF9F4F' }}>
                #{tag}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 진행 바 ── */}
      <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 70 }}>
        <div style={{ width: 640, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: '#FF6F0F', borderRadius: 2 }} />
        </div>
      </AbsoluteFill>

      {/* ── 브랜드 로고 ── */}
      <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'flex-end', padding: '52px 52px 0 0', opacity: topOpacity }}>
        <div style={{ background: 'rgba(255,111,15,0.9)', borderRadius: 14, padding: '7px 16px', fontSize: 22, fontWeight: 800, color: '#fff' }}>
          언니픽
        </div>
      </AbsoluteFill>

      {/* ── 안내방송 인디케이터 ── */}
      {announcementUrl && annFrames > 0 && frame < annFrames && (
        <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'flex-start', padding: '52px 0 0 52px' }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 30, padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6F0F', opacity: Math.sin(frame / 8) * 0.5 + 0.5 }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: 600 }}>안내방송 중</span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
