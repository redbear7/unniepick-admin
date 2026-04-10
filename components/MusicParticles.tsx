'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

// 파티 컬러 팔레트 — 네온 + 파스텔 혼합
const PARTY_COLORS = [
  '#ff2d78', '#ff6b35', '#ffd93d', '#6bcb77',
  '#4d96ff', '#c77dff', '#ff9f1c', '#2ec4b6',
  '#e63946', '#f72585', '#7209b7', '#3a86ff',
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;      // 0~1 (1=신생, 0=소멸)
  decay: number;
  twinkle: number;   // 반짝임 속도
  twinklePhase: number;
  shape: 'circle' | 'star' | 'diamond';
}

function randomColor() {
  return PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)];
}

function spawnParticle(canvas: HTMLCanvasElement, bass: number): Particle {
  const x = Math.random() * canvas.width;
  const y = canvas.height * (0.6 + Math.random() * 0.4);
  const speed = 0.5 + bass * 3 + Math.random() * 1.5;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
  return {
    x, y,
    vx: Math.cos(angle) * speed * (0.4 + Math.random() * 0.6),
    vy: Math.sin(angle) * speed,
    size: 2 + Math.random() * (3 + bass * 5),
    color: randomColor(),
    alpha: 0.7 + Math.random() * 0.3,
    life: 1,
    decay: 0.008 + Math.random() * 0.012,
    twinkle: 3 + Math.random() * 6,
    twinklePhase: Math.random() * Math.PI * 2,
    shape: (['circle', 'star', 'diamond'] as const)[Math.floor(Math.random() * 3)],
  };
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const points = 4;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.6, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.6, y);
  ctx.closePath();
  ctx.fill();
}

export default function MusicParticles() {
  const { isPlaying, bassLevel } = usePlayer();
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef      = useRef<number>(0);
  const bassRef     = useRef(0);
  const playingRef  = useRef(false);
  const frameRef    = useRef(0);

  // 최신 값 동기화
  useEffect(() => { bassRef.current = bassLevel; }, [bassLevel]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    frameRef.current++;
    const bass = bassRef.current;
    const playing = playingRef.current;

    // 배경 페이드 (트레일 효과)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 재생 중일 때 파티클 스폰
    if (playing) {
      const spawnCount = Math.floor(1 + bass * 6);
      for (let i = 0; i < spawnCount; i++) {
        if (particlesRef.current.length < 200) {
          particlesRef.current.push(spawnParticle(canvas, bass));
        }
      }

      // 베이스 펄스 — 하단 글로우 라인
      const gradient = ctx.createLinearGradient(0, canvas.height - 4, 0, canvas.height);
      gradient.addColorStop(0, `rgba(255,255,255,${bass * 0.6})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height - 4, canvas.width, 4);
    }

    // 파티클 업데이트 & 렌더
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    for (const p of particlesRef.current) {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy -= 0.04; // 부력 (위로 가속)
      p.vx += (Math.random() - 0.5) * 0.1; // 가로 흔들림
      p.life -= playing ? p.decay : p.decay * 2;

      const twinkleAlpha = p.alpha * p.life *
        (0.6 + 0.4 * Math.sin(frameRef.current * 0.1 * p.twinkle + p.twinklePhase));

      ctx.globalAlpha = Math.max(0, twinkleAlpha);
      ctx.fillStyle = p.color;

      // 글로우
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size * 2;

      if (p.shape === 'star') {
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

    ctx.globalAlpha = 1;
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // 마운트 시 애니메이션 시작
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full pointer-events-none"
      style={{ height: 56, display: 'block', background: 'transparent' }}
    />
  );
}
