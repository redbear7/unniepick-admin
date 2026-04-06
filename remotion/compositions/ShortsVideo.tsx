import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

interface ShortsVideoProps {
  audioUrl: string;
  coverUrl: string | null;
  title: string;
  artist: string;
  coverEmoji: string;
  startTimeSec: number;
  moodTags: string[];
}

export const ShortsVideo: React.FC<ShortsVideoProps> = ({
  audioUrl,
  coverUrl,
  title,
  artist,
  coverEmoji,
  startTimeSec,
  moodTags,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 진행도 (0~1)
  const progress = frame / durationInFrames;

  // 타이틀 등장 애니메이션
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });

  // 아티스트 등장 (딜레이)
  const artistOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  // 앨범아트 scale 펄스 (BPM 느낌)
  const pulse = Math.sin(frame / 8) * 0.02 + 1;

  // 파형 바 애니메이션
  const bars = Array.from({ length: 24 }, (_, i) => {
    const phase = (i / 24) * Math.PI * 2;
    const height = Math.abs(Math.sin(frame / 10 + phase)) * 60 + 20;
    return height;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: 'sans-serif' }}>
      {/* 오디오 (클라이맥스 구간부터) */}
      <Audio src={audioUrl} startFrom={Math.round(startTimeSec * fps)} />

      {/* 배경: 앨범아트 blur */}
      <AbsoluteFill>
        {coverUrl ? (
          <Img
            src={coverUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(40px) brightness(0.3)',
              transform: 'scale(1.1)',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            }}
          />
        )}
      </AbsoluteFill>

      {/* 그라데이션 오버레이 (위아래) */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      {/* 앨범 아트 (중앙) */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 480,
            height: 480,
            borderRadius: 32,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
            transform: `scale(${pulse})`,
            marginTop: -80,
          }}
        >
          {coverUrl ? (
            <Img
              src={coverUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #FF6F0F33, #FF6F0F)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 160,
              }}
            >
              {coverEmoji}
            </div>
          )}
        </div>
      </AbsoluteFill>

      {/* 파형 바 (앨범아트 하단) */}
      <AbsoluteFill
        style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 340 }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 80 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: h,
                borderRadius: 3,
                background: `rgba(255, 111, 15, ${0.5 + (h / 80) * 0.5})`,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* 트랙 정보 (하단) */}
      <AbsoluteFill
        style={{
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '0 48px 140px',
        }}
      >
        <div>
          {/* 제목 */}
          <div
            style={{
              color: '#fff',
              fontSize: 48,
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: 12,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              textShadow: '0 2px 20px rgba(0,0,0,0.8)',
              maxWidth: 580,
            }}
          >
            {title}
          </div>

          {/* 아티스트 */}
          <div
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 30,
              fontWeight: 500,
              opacity: artistOpacity,
              textShadow: '0 2px 10px rgba(0,0,0,0.6)',
            }}
          >
            {artist}
          </div>

          {/* 무드 태그 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {moodTags.slice(0, 3).map((tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(255,111,15,0.3)',
                  border: '1px solid rgba(255,111,15,0.5)',
                  borderRadius: 20,
                  padding: '4px 14px',
                  fontSize: 22,
                  color: '#FF9F4F',
                  opacity: artistOpacity,
                }}
              >
                #{tag}
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>

      {/* 진행 바 */}
      <AbsoluteFill
        style={{ alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 80 }}
      >
        <div
          style={{
            width: 640,
            height: 4,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 2,
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              background: '#FF6F0F',
              borderRadius: 2,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* 브랜드 로고 (상단 우측) */}
      <AbsoluteFill
        style={{
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '48px 48px 0 0',
        }}
      >
        <div
          style={{
            background: 'rgba(255,111,15,0.9)',
            borderRadius: 16,
            padding: '8px 18px',
            fontSize: 24,
            fontWeight: 800,
            color: '#fff',
            opacity: titleOpacity,
          }}
        >
          언니픽
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
