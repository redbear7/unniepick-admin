import React from 'react';
import { AbsoluteFill, Audio, interpolate, Easing, useCurrentFrame, useVideoConfig } from 'remotion';

export interface CardNewsVideoProps {
  audioUrl: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeCategory: string;
  storeImageUrl: string;
  template: 'modern' | 'bright' | 'minimal';
}

const CARD_DURATION = 120; // 4 seconds at 30fps
const CARDS_COUNT = 5;
const TOTAL_FRAMES = CARD_DURATION * CARDS_COUNT;

// Template colors
const TEMPLATES = {
  modern: {
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    text: '#ffffff',
    accent: '#FF6F0F',
    card2Bg: 'linear-gradient(135deg, #00a8ff 0%, #0084d4 100%)',
    card3Bg: 'linear-gradient(135deg, #ff006e 0%, #d90066 100%)',
  },
  bright: {
    bg: 'linear-gradient(135deg, #fff5e6 0%, #ffe0b2 100%)',
    text: '#1a1a1a',
    accent: '#FF6F0F',
    card2Bg: 'linear-gradient(135deg, #FFB347 0%, #FF8C00 100%)',
    card3Bg: 'linear-gradient(135deg, #FF69B4 0%, #FF1493 100%)',
  },
  minimal: {
    bg: '#ffffff',
    text: '#000000',
    accent: '#FF6F0F',
    card2Bg: '#f5f5f5',
    card3Bg: '#eeeeee',
  },
};

function FadeInText({ text, startFrame, duration = 20 }: { text: string; startFrame: number; duration?: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ opacity }}>
      {text}
    </div>
  );
}

function Card1Intro({ template }: { template: 'modern' | 'bright' | 'minimal' }) {
  const frame = useCurrentFrame();
  const colors = TEMPLATES[template];
  const startFrame = 0;

  // Fade in entire card
  const cardOpacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Blur/scale animation on background
  const scale = interpolate(frame, [startFrame, CARD_DURATION], [1.1, 1], {
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        opacity: frame >= startFrame && frame < startFrame + CARD_DURATION ? cardOpacity : 0,
      }}>
      {/* Background image with zoom */}
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='1280'%3E%3Crect fill='%23333' width='720' height='1280'/%3E%3C/svg%3E"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(8px) brightness(0.5)',
          transform: `scale(${scale})`,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px',
          textAlign: 'center',
        }}>
        <FadeInText
          text={`${frame < startFrame + CARD_DURATION ? '🎬' : ''}`}
          startFrame={startFrame}
          duration={15}
        />
        <div
          style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: colors.text,
            marginTop: '20px',
            opacity: cardOpacity,
          }}>
          업체 소개
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Card2Location({ storeAddress, template }: { storeAddress: string; template: 'modern' | 'bright' | 'minimal' }) {
  const frame = useCurrentFrame();
  const colors = TEMPLATES[template];
  const startFrame = CARD_DURATION;

  const cardOpacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.card2Bg,
        opacity: frame >= startFrame && frame < startFrame + CARD_DURATION ? cardOpacity : 0,
      }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px',
          textAlign: 'center',
        }}>
        <div
          style={{
            fontSize: '60px',
            marginBottom: '30px',
            animation: 'pulse 2s infinite',
          }}>
          📍
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: '15px',
          }}>
          위치
        </div>
        <div
          style={{
            fontSize: '20px',
            color: colors.text,
            opacity: 0.9,
            lineHeight: '1.6',
          }}>
          {storeAddress}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Card3Contact({ storePhone, template }: { storePhone: string; template: 'modern' | 'bright' | 'minimal' }) {
  const frame = useCurrentFrame();
  const colors = TEMPLATES[template];
  const startFrame = CARD_DURATION * 2;

  const cardOpacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.card3Bg,
        opacity: frame >= startFrame && frame < startFrame + CARD_DURATION ? cardOpacity : 0,
      }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px',
          textAlign: 'center',
        }}>
        <div
          style={{
            fontSize: '60px',
            marginBottom: '30px',
          }}>
          ☎️
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: '15px',
          }}>
          연락처
        </div>
        <div
          style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: colors.text,
            fontFamily: 'monospace',
          }}>
          {storePhone}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Card4Image({ storeImageUrl, template }: { storeImageUrl: string; template: 'modern' | 'bright' | 'minimal' }) {
  const frame = useCurrentFrame();
  const colors = TEMPLATES[template];
  const startFrame = CARD_DURATION * 3;

  const cardOpacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame, [startFrame + 20, startFrame + CARD_DURATION], [1, 1.05], {
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill
      style={{
        opacity: frame >= startFrame && frame < startFrame + CARD_DURATION ? cardOpacity : 0,
      }}>
      <img
        src={storeImageUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
        }}
      />
      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.2)',
        }}
      />
    </AbsoluteFill>
  );
}

function Card5CTA({ template }: { template: 'modern' | 'bright' | 'minimal' }) {
  const frame = useCurrentFrame();
  const colors = TEMPLATES[template];
  const startFrame = CARD_DURATION * 4;

  const cardOpacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const btnScale = interpolate(frame, [startFrame + 50, startFrame + 60], [1, 1.1], {
    easing: Easing.inOut(Easing.ease),
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.accent} 0%, #ff8c3a 100%)`,
        opacity: frame >= startFrame && frame < startFrame + CARD_DURATION ? cardOpacity : 0,
      }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px',
          textAlign: 'center',
        }}>
        <div
          style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '40px',
            lineHeight: '1.4',
          }}>
          지금 바로<br />문의하세요!
        </div>
        <div
          style={{
            padding: '15px 40px',
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '50px',
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: 'bold',
            transform: `scale(${btnScale})`,
            border: '2px solid #ffffff',
          }}>
          방문하기
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Branding() {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        background: '#FF6F0F',
        color: '#ffffff',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold',
        opacity,
      }}>
      🎬 언니픽
    </div>
  );
}

export const CardNewsVideo: React.FC<CardNewsVideoProps> = ({
  audioUrl,
  storeName,
  storeAddress,
  storePhone,
  storeCategory,
  storeImageUrl,
  template,
}) => {
  return (
    <AbsoluteFill style={{ background: '#000000' }}>
      {/* Audio */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Cards */}
      <Card1Intro template={template} />
      <Card2Location storeAddress={storeAddress} template={template} />
      <Card3Contact storePhone={storePhone} template={template} />
      <Card4Image storeImageUrl={storeImageUrl} template={template} />
      <Card5CTA template={template} />

      {/* Branding */}
      <Branding />
    </AbsoluteFill>
  );
};
