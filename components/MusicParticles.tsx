'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

type Effect = 'spark' | 'fireworks' | 'snow' | 'bubble' | 'confetti' | 'aurora';

const EFFECTS: { id: Effect; icon: string; label: string }[] = [
  { id: 'spark',     icon: '✦', label: 'Spark'     },
  { id: 'fireworks', icon: '❋', label: 'Fireworks' },
  { id: 'snow',      icon: '❄', label: 'Snow'      },
  { id: 'bubble',    icon: '◎', label: 'Bubble'    },
  { id: 'confetti',  icon: '▦', label: 'Confetti'  },
  { id: 'aurora',    icon: '≋', label: 'Aurora'    },
];

const PARTY_COLORS = [
  '#ff2d78','#ff6b35','#ffd93d','#6bcb77',
  '#4d96ff','#c77dff','#ff9f1c','#2ec4b6',
  '#e63946','#f72585','#7209b7','#3a86ff',
];
const SNOW_COLORS  = ['#ffffff','#e0f0ff','#b8d8f8','#d0eaff'];
const BUBBLE_COLORS= ['#88ccff','#aaddff','#66bbff','#44aaee'];

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
  w: number; h: number; // confetti rect
}

const rnd  = () => Math.random();
const rndC = () => PARTY_COLORS[Math.floor(rnd() * PARTY_COLORS.length)];

function base(x: number, y: number, color: string, size: number): Particle {
  return {
    x, y, vx: 0, vy: 0, size, color,
    alpha: 0.85 + rnd() * 0.15,
    life: 1, decay: 0.01 + rnd() * 0.012,
    twinkle: 3 + rnd() * 5, twinklePhase: rnd() * Math.PI * 2,
    shape: 'circle', rotation: 0, rotSpeed: 0, w: 0, h: 0,
  };
}

function spawnSpark(W: number, H: number, bass: number): Particle {
  // ── 최저속도 대폭 감소 ──
  const speed = 0.04 + bass * 1.8 + rnd() * 0.35;
  const angle = -Math.PI / 2 + (rnd() - 0.5) * 1.4;
  const shapes: Particle['shape'][] = ['circle','star','diamond'];
  const p = base(rnd() * W, H, rndC(), 1.5 + rnd() * (2.5 + bass * 4));
  p.vx = Math.cos(angle) * speed * (0.4 + rnd() * 0.6);
  p.vy = Math.sin(angle) * speed;
  p.shape = shapes[Math.floor(rnd() * shapes.length)];
  return p;
}

function spawnFirework(cx: number, cy: number, idx: number, count: number): Particle {
  const angle = (idx / count) * Math.PI * 2;
  const speed = 1.2 + rnd() * 2.5;
  const p = base(cx, cy, rndC(), 2 + rnd() * 2.5);
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

function spawnConfetti(W: number): Particle {
  const p = base(rnd() * W, -6, rndC(), 3);
  p.vx = (rnd() - 0.5) * 1.2;
  p.vy = 0.6 + rnd() * 1.0;
  p.rotation = rnd() * Math.PI * 2;
  p.rotSpeed = (rnd() - 0.5) * 0.15;
  p.w = 4 + rnd() * 6;
  p.h = 2 + rnd() * 3;
  p.decay = 0;
  p.alpha = 0.8 + rnd() * 0.2;
  p.shape = 'circle'; // unused, using rect
  return p;
}

// ── 도형 그리기 ────────────────────────────────────────────────────
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

const LS_KEY = 'particle_effect';

export default function MusicParticles() {
  const { isPlaying, bassLevel } = usePlayer();
  const [effect, setEffect] = useState<Effect>('spark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(LS_KEY) as Effect | null;
    if (saved && EFFECTS.find(e => e.id === saved)) setEffect(saved);
  }, []);

  const changeEffect = (e: Effect) => {
    setEffect(e);
    localStorage.setItem(LS_KEY, e);
  };

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef       = useRef<number>(0);
  const bassRef      = useRef(0);
  const playingRef   = useRef(false);
  const effectRef    = useRef<Effect>('spark');
  const frameRef     = useRef(0);
  const prevBassRef  = useRef(0);

  useEffect(() => { bassRef.current   = bassLevel; }, [bassLevel]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { effectRef.current  = effect; }, [effect]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    frameRef.current++;
    const bass    = bassRef.current;
    const playing = playingRef.current;
    const ef      = effectRef.current;
    const W = canvas.width, H = canvas.height;
    const ps = particlesRef.current;

    // ── Aurora: 파티클 없는 독립 렌더 ──────────────────────────────
    if (ef === 'aurora') {
      ctx.clearRect(0, 0, W, H);
      const t = frameRef.current * 0.018;
      const bands = 4;
      for (let b = 0; b < bands; b++) {
        const hue = ((t * 25) + b * 70) % 360;
        const amp = 6 + bass * 18;
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

    // ── 배경 페이드 ────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 0, W, H);

    // ── 파티클 스폰 ────────────────────────────────────────────────
    if (playing) {
      if (ef === 'spark') {
        const n = Math.floor(0.5 + bass * 5);
        for (let i = 0; i < n && ps.length < 200; i++) ps.push(spawnSpark(W, H, bass));

      } else if (ef === 'fireworks') {
        // 베이스 피크 감지 → 폭발
        if (bass > 0.72 && prevBassRef.current <= 0.72) {
          const cx = rnd() * W, cy = rnd() * H;
          const count = 18 + Math.floor(bass * 14);
          for (let i = 0; i < count; i++) ps.push(spawnFirework(cx, cy, i, count));
        }
        // 자잘한 파티클도 상시 발사
        if (rnd() < 0.3 + bass * 0.5 && ps.length < 300) {
          const cx = rnd() * W, cy = rnd() * H * 0.8;
          for (let i = 0; i < 6; i++) ps.push(spawnFirework(cx, cy, i, 6));
        }

      } else if (ef === 'snow') {
        const n = Math.floor(0.3 + bass * 3);
        for (let i = 0; i < n && ps.length < 150; i++) ps.push(spawnSnow(W));

      } else if (ef === 'bubble') {
        const n = Math.floor(0.2 + bass * 2.5);
        for (let i = 0; i < n && ps.length < 80; i++) ps.push(spawnBubble(W, H, bass));

      } else if (ef === 'confetti') {
        const n = Math.floor(0.4 + bass * 4);
        for (let i = 0; i < n && ps.length < 200; i++) ps.push(spawnConfetti(W));
      }
    }
    prevBassRef.current = bass;

    // ── 파티클 업데이트 & 렌더 ─────────────────────────────────────
    particlesRef.current = ps.filter(p => {
      if (ef === 'snow' || ef === 'bubble')    return p.y > -10 && p.y < H + 10;
      if (ef === 'confetti') return p.y > -10 && p.y < H + 10;
      return p.life > 0.02;
    });

    for (const p of particlesRef.current) {
      // 물리
      if (ef === 'spark') {
        p.vy -= 0.035; // 부력
        p.vx += (rnd() - 0.5) * 0.06;
        p.life -= playing ? p.decay : p.decay * 2.5;
      } else if (ef === 'fireworks') {
        p.vx *= 0.97; p.vy *= 0.97;
        p.vy += 0.04; // 중력
        p.life -= playing ? p.decay : p.decay * 2;
      } else if (ef === 'snow') {
        p.vx += (rnd() - 0.5) * 0.04 + (bass > 0.6 ? (rnd() - 0.5) * 0.3 : 0);
        p.vy += 0.008;
      } else if (ef === 'bubble') {
        p.vx += Math.sin(frameRef.current * 0.05 + p.twinklePhase) * 0.04;
        p.vy -= 0.005; // 더 빨라짐
      } else if (ef === 'confetti') {
        p.rotation += p.rotSpeed;
        p.vx *= 0.995;
        p.vy += 0.012;
      }
      p.x += p.vx;
      p.y += p.vy;

      // 알파
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

    // 베이스 펄스 라인 (aurora 제외)
    if (playing && bass > 0.3) {
      const grd = ctx.createLinearGradient(0, H - 3, 0, H);
      grd.addColorStop(0, `rgba(255,255,255,${bass * 0.5})`);
      grd.addColorStop(1, 'transparent');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grd;
      ctx.fillRect(0, H - 3, W, 3);
    }

    ctx.globalAlpha = 1;
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
