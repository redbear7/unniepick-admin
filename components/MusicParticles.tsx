'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTheme } from 'next-themes';
import { usePlayer } from '@/contexts/PlayerContext';

type Effect = 'spark' | 'fireworks' | 'snow' | 'bubble' | 'confetti' | 'aurora' | 'laser' | 'vinyl';

const EFFECTS: { id: Effect; icon: string; label: string }[] = [
  { id: 'spark',     icon: '✦', label: 'Spark'     },
  { id: 'fireworks', icon: '❋', label: 'Fireworks' },
  { id: 'snow',      icon: '❄', label: 'Snow'      },
  { id: 'bubble',    icon: '◎', label: 'Bubble'    },
  { id: 'confetti',  icon: '▦', label: 'Confetti'  },
  { id: 'aurora',    icon: '≋', label: 'Aurora'    },
  { id: 'laser',     icon: '⚡', label: 'Laser'    },
  { id: 'vinyl',     icon: '◉', label: 'Vinyl'     },
];

// ── 테마별 파티클 색상 팔레트 ──────────────────────────────────────────
const THEME_PALETTES: Record<string, string[]> = {
  light:       ['#6366f1','#8b5cf6','#ec4899','#3b82f6','#f59e0b'],
  dark:        ['#1ed760','#22c55e','#4ade80','#86efac','#34d399'],
  ferrari:     ['#DC0000','#ff3333','#ff6b35','#ffd93d','#ff9f1c'],
  obsidian:    ['#c9a227','#d4b44a','#e8c55f','#f5d76e','#a0840a'],
  sand:        ['#c2832a','#d4943a','#e8a84d','#b87333','#8B5E1A'],
  sky:         ['#0ea5e9','#38bdf8','#7dd3fc','#22d3ee','#06b6d4'],
  nord:        ['#88c0d0','#81a1c1','#5e81ac','#b48ead','#a3be8c'],
  tokyonight:  ['#7aa2f7','#bb9af7','#9ece6a','#e0af68','#f7768e'],
  dracula:     ['#bd93f9','#ff79c6','#50fa7b','#f1fa8c','#8be9fd'],
  mint:        ['#10b981','#34d399','#6ee7b7','#059669','#047857'],
  lavender:    ['#8b5cf6','#a78bfa','#c4b5fd','#7c3aed','#6d28d9'],
  peach:       ['#f97316','#fb923c','#fdba74','#ea580c','#c2410c'],
  catppuccin:  ['#cba6f7','#f38ba8','#a6e3a1','#f9e2af','#89dceb'],
  gruvbox:     ['#d79921','#b8bb26','#cc241d','#458588','#689d6a'],
  matrix:      ['#00ff41','#39ff14','#00d400','#00aa00','#80ff00'],
  cyberpunk:   ['#ff2d78','#ff6b35','#ffd93d','#00ffcc','#7b2fff'],
  onedark:     ['#61afef','#c678dd','#98c379','#e5c07b','#e06c75'],
  solarized:   ['#268bd2','#2aa198','#859900','#b58900','#cb4b16'],
  paper:       ['#374151','#6b7280','#9ca3af','#4b5563','#1f2937'],
  rose:        ['#e11d48','#f43f5e','#fb7185','#be123c','#9f1239'],
  lemon:       ['#ca8a04','#eab308','#facc15','#fde047','#a16207'],
  lamborghini: ['#e86900','#ff8c00','#ffaa33','#e65c00','#cc5500'],
  porsche:     ['#e30713','#cc0011','#ff4455','#ffd700','#cc0000'],
  oled:        ['#ffffff','#e0e0e0','#c0c0c0','#a0a0a0','#606060'],
};

const SNOW_COLORS   = ['#ffffff','#e0f0ff','#b8d8f8','#d0eaff'];
const BUBBLE_COLORS = ['#88ccff','#aaddff','#66bbff','#44aaee'];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  decay: number;
  twinkle: number;
  twinklePhase: number;
  shape: 'circle' | 'star' | 'diamond' | 'ring';
  rotation: number;
  rotSpeed: number;
  w: number; h: number;
}

interface LaserBeam {
  x: number;
  vx: number;
  color: string;
  alpha: number;
  glowW: number;
  phase: number;
}

const rnd     = () => Math.random();
const rndFrom = (arr: string[]) => arr[Math.floor(rnd() * arr.length)];

function base(x: number, y: number, color: string, size: number): Particle {
  return {
    x, y, vx: 0, vy: 0, size, color,
    alpha: 0.85 + rnd() * 0.15,
    life: 1, decay: 0.01 + rnd() * 0.012,
    twinkle: 3 + rnd() * 5, twinklePhase: rnd() * Math.PI * 2,
    shape: 'circle', rotation: 0, rotSpeed: 0, w: 0, h: 0,
  };
}

function spawnSpark(W: number, H: number, bass: number, palette: string[]): Particle {
  const speed = 0.04 + bass * 1.8 + rnd() * 0.35;
  const angle = -Math.PI / 2 + (rnd() - 0.5) * 1.4;
  const shapes: Particle['shape'][] = ['circle','star','diamond'];
  const p = base(rnd() * W, H, rndFrom(palette), 1.5 + rnd() * (2.5 + bass * 4));
  p.vx = Math.cos(angle) * speed * (0.4 + rnd() * 0.6);
  p.vy = Math.sin(angle) * speed;
  p.shape = shapes[Math.floor(rnd() * shapes.length)];
  return p;
}

function spawnFirework(cx: number, cy: number, idx: number, count: number, palette: string[]): Particle {
  const angle = (idx / count) * Math.PI * 2;
  const speed = 1.2 + rnd() * 2.5;
  const p = base(cx, cy, rndFrom(palette), 2 + rnd() * 2.5);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.decay = 0.018 + rnd() * 0.01;
  p.shape = 'star';
  return p;
}

function spawnSnow(W: number): Particle {
  const p = base(rnd() * W, -4, SNOW_COLORS[Math.floor(rnd() * SNOW_COLORS.length)], 2 + rnd() * 3.5);
  p.vx = (rnd() - 0.5) * 0.4;
  p.vy = 0.3 + rnd() * 0.5;
  p.shape = 'star';
  p.decay = 0;
  p.alpha = 0.5 + rnd() * 0.5;
  return p;
}

function spawnBubble(W: number, H: number, bass: number): Particle {
  const p = base(rnd() * W, H + 4, BUBBLE_COLORS[Math.floor(rnd() * BUBBLE_COLORS.length)], 4 + rnd() * (6 + bass * 8));
  p.vx = (rnd() - 0.5) * 0.4;
  p.vy = -(0.3 + rnd() * 0.6 + bass * 0.6);
  p.shape = 'ring';
  p.alpha = 0.25 + rnd() * 0.35;
  p.decay = 0;
  return p;
}

function spawnConfetti(W: number, palette: string[]): Particle {
  const p = base(rnd() * W, -6, rndFrom(palette), 3);
  p.vx = (rnd() - 0.5) * 1.2;
  p.vy = 0.6 + rnd() * 1.0;
  p.rotation = rnd() * Math.PI * 2;
  p.rotSpeed = (rnd() - 0.5) * 0.15;
  p.w = 4 + rnd() * 6;
  p.h = 2 + rnd() * 3;
  p.decay = 0;
  p.alpha = 0.8 + rnd() * 0.2;
  return p;
}

function initLasers(W: number, palette: string[]): LaserBeam[] {
  const count = 5;
  return Array.from({ length: count }, (_, i) => ({
    x:     (W / (count + 1)) * (i + 1),
    vx:    ((rnd() - 0.5) * 1.5 + (i % 2 === 0 ? 0.9 : -0.9)),
    color: palette[i % palette.length],
    alpha: 0.6 + rnd() * 0.3,
    glowW: 20 + rnd() * 18,
    phase: rnd() * Math.PI * 2,
  }));
}

// ── 도형 그리기 ────────────────────────────────────────────────────────
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    i === 0 ? ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
            : ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
}
function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.6, y);
  ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.6, y);
  ctx.closePath(); ctx.fill();
}
function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
function drawRect(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  ctx.restore();
}

// ── 바이닐 렌더 ────────────────────────────────────────────────────────
function drawVinyl(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  bass: number,
  angle: number,
  palette: string[],
  playing: boolean,
  frame: number,
) {
  ctx.clearRect(0, 0, W, H);

  // 왼쪽 배경 그라디언트 (레코드 가시성 확보)
  const bgGrd = ctx.createLinearGradient(0, 0, W * 0.65, 0);
  bgGrd.addColorStop(0,   'rgba(0,0,0,0.82)');
  bgGrd.addColorStop(0.7, 'rgba(0,0,0,0.3)');
  bgGrd.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, W, H);

  const cy  = H / 2;
  const R   = H * 0.40;
  const cx  = R * 1.15; // 왼쪽 고정

  // 베이스 글로우
  if (bass > 0.2) {
    ctx.beginPath();
    ctx.arc(cx, cy, R + 2 + bass * 9, 0, Math.PI * 2);
    ctx.strokeStyle = palette[0];
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = bass * 0.65;
    ctx.shadowColor = palette[0];
    ctx.shadowBlur  = 14 + bass * 22;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }

  // 레코드 본체
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#0e0e0e';
  ctx.fill();

  // 홈(그루브) 링
  for (let r = R * 0.34; r < R * 0.95; r += R * 0.046) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth   = 0.7;
    ctx.stroke();
  }

  // 회전 레이블
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const labelR = R * 0.28;
  const grd    = ctx.createRadialGradient(0, 0, 0, 0, 0, labelR);
  grd.addColorStop(0,   palette[0]);
  grd.addColorStop(0.6, palette[1] ?? palette[0]);
  grd.addColorStop(1,   '#111');
  ctx.beginPath();
  ctx.arc(0, 0, labelR, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // 레이블 스트라이프
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, labelR, a, a + Math.PI / 3);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 스핀들 (중심 홀)
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = '#2a2a2a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.016, 0, Math.PI * 2);
  ctx.fillStyle = '#888';
  ctx.fill();

  // 톤암
  const pivotX  = cx + R * 1.45;
  const pivotY  = cy - R * 0.55;
  const armAngle = Math.PI + 0.42;
  const armLen   = R * 1.08;
  const tipX = pivotX + Math.cos(armAngle) * armLen;
  const tipY = pivotY + Math.sin(armAngle) * armLen;

  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = '#777';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#999';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
  ctx.fillStyle = palette[0];
  ctx.shadowColor = palette[0];
  ctx.shadowBlur  = 5;
  ctx.fill();
  ctx.shadowBlur  = 0;

  // 이퀄라이저 바 (톤암 오른쪽)
  if (playing) {
    const eqX   = pivotX + 18;
    const eqMaxW = Math.min(W - eqX - 12, 130);
    if (eqMaxW > 24) {
      const bars = 14;
      const barW = (eqMaxW / bars) * 0.65;
      const gap  = (eqMaxW / bars) * 0.35;
      for (let i = 0; i < bars; i++) {
        const h = Math.max(2, (bass * 0.55 + Math.abs(Math.sin(frame * 0.14 + i * 0.75)) * 0.45) * H * 0.7);
        const bx = eqX + i * (barW + gap);
        const by = cy - h / 2;
        const col = palette[i % palette.length];
        ctx.globalAlpha = 0.5 + bass * 0.45;
        ctx.fillStyle   = col;
        ctx.shadowColor = col;
        ctx.shadowBlur  = 5;
        ctx.fillRect(bx, by, barW, h);
      }
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }
  }
}

const LS_KEY = 'particle_effect';

export default function MusicParticles() {
  const { theme }                         = useTheme();
  const { isPlaying, bassLevel, bassSpeed } = usePlayer();
  const [effect, setEffect]  = useState<Effect>('spark');
  const [mounted, setMounted] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const particlesRef  = useRef<Particle[]>([]);
  const lasersRef     = useRef<LaserBeam[]>([]);
  const vinylAngleRef = useRef(0);
  const rafRef        = useRef<number>(0);
  const bassRef       = useRef(0);
  const bassSpeedRef  = useRef(1.0);
  const playingRef    = useRef(false);
  const effectRef     = useRef<Effect>('spark');
  const paletteRef    = useRef<string[]>(THEME_PALETTES.dark);
  const frameRef      = useRef(0);
  const prevBassRef   = useRef(0);
  const flashRef      = useRef(0);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(LS_KEY) as Effect | null;
    if (saved && EFFECTS.find(e => e.id === saved)) setEffect(saved);
  }, []);

  const changeEffect = (e: Effect) => {
    setEffect(e);
    localStorage.setItem(LS_KEY, e);
    particlesRef.current = [];
    lasersRef.current    = [];
    flashRef.current     = 0;
  };

  useEffect(() => { bassRef.current      = bassLevel; }, [bassLevel]);
  useEffect(() => { bassSpeedRef.current = bassSpeed; }, [bassSpeed]);
  useEffect(() => { playingRef.current   = isPlaying; }, [isPlaying]);
  useEffect(() => { effectRef.current  = effect;    }, [effect]);
  useEffect(() => {
    const t = theme ?? 'dark';
    paletteRef.current = THEME_PALETTES[t] ?? THEME_PALETTES.dark;
    // 레이저 색상 즉시 갱신
    const p = paletteRef.current;
    lasersRef.current.forEach((b, i) => { b.color = p[i % p.length]; });
  }, [theme]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const speed = bassSpeedRef.current; // 펄스 속도 배율 (0.3~3)
    frameRef.current += speed;          // 시간 기반 애니메이션도 속도 연동
    const bass    = bassRef.current;
    const playing = playingRef.current;
    const ef      = effectRef.current;
    const palette = paletteRef.current;
    const W = canvas.width, H = canvas.height;
    const ps = particlesRef.current;

    // ── Aurora ──────────────────────────────────────────────────────
    if (ef === 'aurora') {
      ctx.clearRect(0, 0, W, H);
      const t     = frameRef.current * 0.018; // frameRef이 speed배 증가하므로 자동 연동
      const bands = 4;
      for (let b = 0; b < bands; b++) {
        const hue  = ((t * 25) + b * 70) % 360;
        const amp  = 6 + bass * 18;
        const yBase = (H / (bands + 1)) * (b + 1);
        ctx.beginPath();
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 3) {
          const y = yBase + Math.sin(x / W * Math.PI * 6 + t + b) * amp;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${hue},100%,70%,${0.25 + bass * 0.55})`;
        ctx.lineWidth   = 1.5 + bass * 3;
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
        ctx.shadowBlur  = 8 + bass * 12;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      }
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    // ── 댄스 클럽 레이저 ─────────────────────────────────────────────
    if (ef === 'laser') {
      // 초기화
      if (lasersRef.current.length === 0) {
        lasersRef.current = initLasers(W, palette);
      }

      // 비트 피크 → 플래시 + 속도 랜덤화
      if (bass > 0.74 && prevBassRef.current <= 0.74) {
        flashRef.current = 10;
        lasersRef.current.forEach(b => {
          b.vx = (rnd() - 0.5) * 3.5 + (rnd() > 0.5 ? 1.4 : -1.4);
        });
      }
      if (flashRef.current > 0) flashRef.current--;

      const flashBoost = flashRef.current > 0 ? (flashRef.current / 10) * 0.8 : 0;

      // 배경 스모크 페이드
      ctx.fillStyle = `rgba(0,0,0,${0.22 + bass * 0.08})`;
      ctx.fillRect(0, 0, W, H);

      for (const b of lasersRef.current) {
        b.x     += b.vx * (1 + bass * 1.8) * speed;
        b.phase += 0.035 * speed;

        if (b.x < 0)  { b.x = 0;  b.vx =  Math.abs(b.vx); }
        if (b.x > W)  { b.x = W;  b.vx = -Math.abs(b.vx); }

        const flicker    = 0.82 + Math.sin(b.phase * 3.9) * 0.18;
        const beamAlpha  = b.alpha * flicker + flashBoost * 0.35;

        // 넓은 글로우
        const gW  = b.glowW + bass * 22 + flashBoost * 20;
        const grd = ctx.createLinearGradient(b.x - gW, 0, b.x + gW, 0);
        grd.addColorStop(0,   'transparent');
        grd.addColorStop(0.38, b.color + '38');
        grd.addColorStop(0.5,  b.color + '88');
        grd.addColorStop(0.62, b.color + '38');
        grd.addColorStop(1,   'transparent');

        ctx.globalAlpha = Math.min(1, beamAlpha);
        ctx.fillStyle   = grd;
        ctx.fillRect(b.x - gW, 0, gW * 2, H);

        // 중앙 밝은 코어
        ctx.globalAlpha = Math.min(1, beamAlpha * 0.9 + flashBoost * 0.4);
        ctx.fillStyle   = '#ffffff';
        ctx.shadowColor = b.color;
        ctx.shadowBlur  = 7 + bass * 12 + flashBoost * 10;
        ctx.fillRect(b.x - 1, 0, 2, H);
        ctx.shadowBlur  = 0;

        // 바닥 반사광
        const refGrd = ctx.createLinearGradient(0, H * 0.65, 0, H);
        refGrd.addColorStop(0, 'transparent');
        refGrd.addColorStop(1, b.color + '28');
        ctx.globalAlpha = beamAlpha * 0.45;
        ctx.fillStyle   = refGrd;
        ctx.fillRect(b.x - gW * 0.6, H * 0.65, gW * 1.2, H * 0.35);
      }

      ctx.globalAlpha    = 1;
      prevBassRef.current = bass;
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    // ── 바이닐 ─────────────────────────────────────────────────────────
    if (ef === 'vinyl') {
      if (playing) vinylAngleRef.current += (0.013 + bass * 0.045) * speed;
      drawVinyl(ctx, W, H, bass, vinylAngleRef.current, palette, playing, frameRef.current);
      prevBassRef.current = bass;
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    // ── 배경 페이드 ──────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 0, W, H);

    // ── 파티클 스폰 ──────────────────────────────────────────────────
    if (playing) {
      if (ef === 'spark') {
        const n = Math.floor(0.5 + bass * 5);
        for (let i = 0; i < n && ps.length < 200; i++) ps.push(spawnSpark(W, H, bass, palette));

      } else if (ef === 'fireworks') {
        if (bass > 0.72 && prevBassRef.current <= 0.72) {
          const cx = rnd() * W, cy = rnd() * H;
          const count = 18 + Math.floor(bass * 14);
          for (let i = 0; i < count; i++) ps.push(spawnFirework(cx, cy, i, count, palette));
        }
        if (rnd() < 0.3 + bass * 0.5 && ps.length < 300) {
          const cx = rnd() * W, cy = rnd() * H * 0.8;
          for (let i = 0; i < 6; i++) ps.push(spawnFirework(cx, cy, i, 6, palette));
        }

      } else if (ef === 'snow') {
        const n = Math.floor(0.3 + bass * 3);
        for (let i = 0; i < n && ps.length < 150; i++) ps.push(spawnSnow(W));

      } else if (ef === 'bubble') {
        const n = Math.floor(0.2 + bass * 2.5);
        for (let i = 0; i < n && ps.length < 80; i++) ps.push(spawnBubble(W, H, bass));

      } else if (ef === 'confetti') {
        const n = Math.floor(0.4 + bass * 4);
        for (let i = 0; i < n && ps.length < 200; i++) ps.push(spawnConfetti(W, palette));
      }
    }
    prevBassRef.current = bass;

    // ── 파티클 업데이트 & 렌더 ─────────────────────────────────────────
    particlesRef.current = ps.filter(p => {
      if (ef === 'snow' || ef === 'bubble' || ef === 'confetti') return p.y > -10 && p.y < H + 10;
      return p.life > 0.02;
    });

    for (const p of particlesRef.current) {
      if (ef === 'spark') {
        p.vy -= 0.035 * speed;
        p.vx += (rnd() - 0.5) * 0.06 * speed;
        p.life -= playing ? p.decay * speed : p.decay * 2.5;
      } else if (ef === 'fireworks') {
        const drag = Math.pow(0.97, speed);
        p.vx *= drag; p.vy *= drag;
        p.vy += 0.04 * speed;
        p.life -= playing ? p.decay * speed : p.decay * 2;
      } else if (ef === 'snow') {
        p.vx += ((rnd() - 0.5) * 0.04 + (bass > 0.6 ? (rnd() - 0.5) * 0.3 : 0)) * speed;
        p.vy += 0.008 * speed;
      } else if (ef === 'bubble') {
        p.vx += Math.sin(frameRef.current * 0.05 + p.twinklePhase) * 0.04 * speed;
        p.vy -= 0.005 * speed;
      } else if (ef === 'confetti') {
        p.rotation += p.rotSpeed * speed;
        p.vx *= Math.pow(0.995, speed);
        p.vy += 0.012 * speed;
      }
      p.x += p.vx * speed;
      p.y += p.vy * speed;

      const a = ef === 'spark'
        ? p.alpha * p.life * (0.6 + 0.4 * Math.sin(frameRef.current * 0.1 * p.twinkle + p.twinklePhase))
        : p.alpha * (ef === 'fireworks' ? p.life : 1);

      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = ef === 'snow' ? 4 : ef === 'bubble' ? 6 : p.size * 2;

      if (ef === 'confetti') {
        drawRect(ctx, p);
      } else if (ef === 'bubble' || p.shape === 'ring') {
        drawRing(ctx, p.x, p.y, p.size);
      } else if (p.shape === 'star') {
        drawStar(ctx, p.x, p.y, p.size);
      } else if (p.shape === 'diamond') {
        drawDiamond(ctx, p.x, p.y, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // 베이스 펄스 라인
    if (playing && bass > 0.3) {
      const grd = ctx.createLinearGradient(0, H - 3, 0, H);
      grd.addColorStop(0, `rgba(255,255,255,${bass * 0.5})`);
      grd.addColorStop(1, 'transparent');
      ctx.globalAlpha = 1;
      ctx.fillStyle   = grd;
      ctx.fillRect(0, H - 3, W, 3);
    }

    ctx.globalAlpha    = 1;
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    rafRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [animate]);

  return (
    <div className="relative w-full shrink-0" style={{ height: 56 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* 이펙트 선택기 */}
      {mounted && (
        <div className="absolute top-1.5 right-2 flex items-center gap-0.5 z-10">
          {EFFECTS.map(e => (
            <button
              key={e.id}
              onClick={() => changeEffect(e.id)}
              title={e.label}
              className={`w-6 h-6 rounded text-[11px] transition flex items-center justify-center
                ${effect === e.id
                  ? 'bg-white/25 text-white shadow-sm'
                  : 'bg-black/20 text-white/40 hover:bg-white/15 hover:text-white/70'
                }`}
            >
              {e.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
