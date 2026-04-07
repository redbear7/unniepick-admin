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
  shortsTitle?: string;
  shortsTagline?: string;
}

export const ShortsVideo: React.FC<ShortsVideoProps> = ({
  audioUrl,
  coverUrl,
  title,
  artist,
  coverEmoji,
  startTimeSec,
  moodTags,
  shortsTitle,
  shortsTagline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = frame / durationInFrames;

  // ── 등장 애니메이션 ──
  const topOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const topY = interpolate(frame, [0, 20], [-24, 0], { extrapolateRight: 'clamp' });
  const bottomOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const bottomY = interpolate(frame, [10, 30], [24, 0], { extrapolateRight: 'clamp' });

  // ── 파형 바 ──
  const bars = Array.from({ length: 20 }, (_, i) => {
    const phase = (i / 20) * Math.PI * 2;
    return Math.abs(Math.sin(frame / 10 + phase)) * 50 + 16;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: 'sans-serif' }}>
      {/* 오디오 */}
      <Audio src={audioUrl} startFrom={Math.round(startTimeSec * fps)} />

      {/* 배경: 커버 이미지 9:16 풀스크린 */}
      <AbsoluteFill>
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
              background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 200,
            }}
          >
            {coverEmoji}
          </div>
        )}
      </AbsoluteFill>

      {/* 그라데이션 오버레이 (위 45% + 아래 55%) */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      {/* ── 상단: 쇼츠 제목 + 강조 문구 ── */}
      {(shortsTitle || shortsTagline) && (
        <AbsoluteFill
          style={{
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: '100px 52px 0',
            opacity: topOpacity,
            transform: `translateY(${topY}px)`,
          }}
        >
          <div>
            {shortsTitle && (
              <div
                style={{
                  color: '#fff',
                  fontSize: 68,
                  fontWeight: 900,
                  lineHeight: 1.15,
                  textShadow: '0 3px 24px rgba(0,0,0,0.9)',
                  letterSpacing: -1,
                  maxWidth: 600,
                }}
              >
                {shortsTitle}
              </div>
            )}
            {shortsTagline && (
              <div
                style={{
                  color: '#FF9F4F',
                  fontSize: 30,
                  fontWeight: 700,
                  marginTop: 14,
                  textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                  maxWidth: 560,
                }}
              >
                {shortsTagline}
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* ── 하단: 노래 제목(작게) + 아티스트 + 파형 + 태그 + 진행바 ── */}
      <AbsoluteFill
        style={{
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '0 52px 130px',
          opacity: bottomOpacity,
          transform: `translateY(${bottomY}px)`,
        }}
      >
        <div style={{ width: '100%' }}>
          {/* 파형 바 */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52, marginBottom: 16 }}>
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: h,
                  borderRadius: 3,
                  background: `rgba(255,111,15,${0.45 + (h / 66) * 0.55})`,
                }}
              />
            ))}
          </div>

          {/* 노래 제목 (작게) */}
          <div
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.3,
              textShadow: '0 2px 12px rgba(0,0,0,0.9)',
              maxWidth: 560,
            }}
          >
            🎵 {title}
          </div>

          {/* 아티스트 */}
          <div
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 22,
              fontWeight: 500,
              marginTop: 6,
              textShadow: '0 1px 8px rgba(0,0,0,0.7)',
            }}
          >
            {artist}
          </div>

          {/* 무드 태그 */}
          {moodTags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {moodTags.slice(0, 3).map((tag) => (
                <div
                  key={tag}
                  style={{
                    background: 'rgba(255,111,15,0.28)',
                    border: '1px solid rgba(255,111,15,0.45)',
                    borderRadius: 20,
                    padding: '3px 13px',
                    fontSize: 18,
                    color: '#FF9F4F',
                  }}
                >
                  #{tag}
                </div>
              ))}
            </div>
          )}
        </div>
      </AbsoluteFill>

      {/* 진행 바 */}
      <AbsoluteFill
        style={{ alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 70 }}
      >
        <div style={{ width: 640, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
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
          padding: '52px 52px 0 0',
          opacity: topOpacity,
        }}
      >
        <div
          style={{
            background: 'rgba(255,111,15,0.9)',
            borderRadius: 14,
            padding: '7px 16px',
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          언니픽
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
