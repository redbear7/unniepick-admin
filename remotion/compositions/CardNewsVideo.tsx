import React from 'react';
import { AbsoluteFill, Html5Audio, interpolate, Easing, useCurrentFrame } from 'remotion';

export interface CardNewsVideoProps {
  audioUrl?: string;
  storeName: string;
  cards: Array<{ title: string; content: string }>;
  template: 'modern' | 'bright' | 'minimal';
}

export const CARD_DURATION = 120; // 4s @ 30fps

const THEMES = {
  modern: {
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    text: '#ffffff',
    accent: '#FF6F0F',
    sub: 'rgba(255,255,255,0.65)',
  },
  bright: {
    bg: 'linear-gradient(135deg, #fff5e6 0%, #ffe0b2 100%)',
    text: '#1a1a1a',
    accent: '#FF6F0F',
    sub: 'rgba(26,26,26,0.65)',
  },
  minimal: {
    bg: '#ffffff',
    text: '#111111',
    accent: '#FF6F0F',
    sub: 'rgba(0,0,0,0.55)',
  },
};

function CardSlide({
  card,
  idx,
  total,
  template,
  storeName,
}: {
  card: { title: string; content: string };
  idx: number;
  total: number;
  template: 'modern' | 'bright' | 'minimal';
  storeName: string;
}) {
  const frame = useCurrentFrame();
  const colors = THEMES[template];
  const startFrame = CARD_DURATION * idx;
  const endFrame = startFrame + CARD_DURATION;

  if (frame < startFrame || frame >= endFrame) return null;

  const local = frame - startFrame;

  const opacity = interpolate(local, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(local, [0, 22], [28, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentOpacity = interpolate(local, [12, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentY = interpolate(local, [12, 32], [20, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.bg,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 56px',
        textAlign: 'center',
      }}
    >
      {/* 카드 번호 */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 48,
          fontSize: 13,
          fontWeight: 700,
          color: colors.accent,
          background: `${colors.accent}22`,
          padding: '5px 13px',
          borderRadius: 20,
          border: `1px solid ${colors.accent}44`,
          letterSpacing: 1,
        }}
      >
        {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      {/* 업체명 */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          right: 48,
          fontSize: 12,
          fontWeight: 600,
          color: colors.sub,
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {storeName}
      </div>

      {/* 제목 */}
      <div
        style={{
          fontSize: 56,
          fontWeight: 900,
          color: colors.text,
          lineHeight: 1.2,
          marginBottom: 28,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {card.title}
      </div>

      {/* 구분선 */}
      <div
        style={{
          width: 56,
          height: 4,
          background: colors.accent,
          borderRadius: 2,
          marginBottom: 28,
          opacity: contentOpacity,
        }}
      />

      {/* 본문 */}
      <div
        style={{
          fontSize: 26,
          color: colors.sub,
          lineHeight: 1.75,
          whiteSpace: 'pre-wrap',
          transform: `translateY(${contentY}px)`,
          opacity: contentOpacity,
        }}
      >
        {card.content}
      </div>

      {/* 브랜딩 */}
      <div
        style={{
          position: 'absolute',
          bottom: 44,
          background: colors.accent,
          color: '#fff',
          padding: '8px 22px',
          borderRadius: 22,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        🎬 언니픽
      </div>
    </AbsoluteFill>
  );
}

export const CardNewsVideo: React.FC<CardNewsVideoProps> = ({
  audioUrl,
  storeName,
  cards,
  template,
}) => {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {audioUrl && <Html5Audio src={audioUrl} />}
      {cards.map((card, idx) => (
        <CardSlide
          key={idx}
          card={card}
          idx={idx}
          total={cards.length}
          template={template}
          storeName={storeName}
        />
      ))}
    </AbsoluteFill>
  );
};
