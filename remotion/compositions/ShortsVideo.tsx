import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Loop,
} from 'remotion';

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

export type WaveformStyle = 'bar' | 'mirror' | 'wave' | 'circle' | 'dots';

interface ShortsVideoProps {
  audioUrl: string;
  coverUrl: string | null;
  bgVideoUrl?: string | null;      // 배경 동영상 URL (있으면 이미지 대신 사용)
  bgVideoDurationSec?: number;     // 동영상 길이 (루프 계산용)
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
}

// ── 파형 렌더러 ──────────────────────────────────────────────────
function Waveform({ style, frame }: { style: WaveformStyle; frame: number }) {
  const COUNT = 20;
  const COLOR_BASE = 'rgba(255,111,15,';

  // 각 바의 높이 (0~1 normalized)
  const amps = Array.from({ length: COUNT }, (_, i) => {
    const phase = (i / COUNT) * Math.PI * 2;
    return Math.abs(Math.sin(frame / 10 + phase));
  });

  if (style === 'bar') {
    const bars = amps.map(a => a * 50 + 16);
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52, marginBottom: 16 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 5, height: h, borderRadius: 3, background: `${COLOR_BASE}${0.45 + (h / 66) * 0.55})` }} />
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
            <div style={{ width: 4, height: h, borderRadius: 2, background: `${COLOR_BASE}${0.5 + amps[i] * 0.5})` }} />
            <div style={{ width: 4, height: h, borderRadius: 2, background: `${COLOR_BASE}${0.3 + amps[i] * 0.4})` }} />
          </div>
        ))}
      </div>
    );
  }

  if (style === 'wave') {
    const W = 616; const H = 52;
    const pts = Array.from({ length: COUNT * 2 + 1 }, (_, i) => {
      const x = (i / (COUNT * 2)) * W;
      const amp = Math.abs(Math.sin(frame / 10 + (i / (COUNT * 2)) * Math.PI * 2)) * (H * 0.38);
      const y = H / 2 - amp;
      return `${x},${y}`;
    }).join(' ');
    const pts2 = Array.from({ length: COUNT * 2 + 1 }, (_, i) => {
      const x = ((COUNT * 2 - i) / (COUNT * 2)) * W;
      const amp = Math.abs(Math.sin(frame / 10 + ((COUNT * 2 - i) / (COUNT * 2)) * Math.PI * 2)) * (H * 0.38);
      const y = H / 2 + amp;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={W} height={H} style={{ marginBottom: 16, display: 'block' }}>
        <defs>
          <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF6F0F" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#FF6F0F" stopOpacity="0.9" />
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
          const angle = (i / COUNT) * Math.PI; // 반원 (위쪽)
          const r = R + a * 14;
          const x = CX + Math.cos(Math.PI - angle) * r;
          const y = CY - Math.sin(angle) * r * 0.7;
          const size = 3 + a * 4;
          return <circle key={i} cx={x} cy={y} r={size} fill={`${COLOR_BASE}${0.4 + a * 0.6})`} />;
        })}
        {/* 중심 펄스 */}
        <circle cx={CX} cy={CY} r={4 + Math.abs(Math.sin(frame / 8)) * 6} fill="none" stroke={`${COLOR_BASE}0.5)`} strokeWidth="1.5" />
      </svg>
    );
  }

  // dots
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 52, marginBottom: 16 }}>
      {amps.map((a, i) => {
        const size = 4 + a * 12;
        return (
          <div key={i} style={{
            width: size, height: size, borderRadius: '50%',
            background: `${COLOR_BASE}${0.4 + a * 0.6})`,
            flexShrink: 0,
            transition: 'none',
          }} />
        );
      })}
    </div>
  );
}

// ── 컴포넌트 ─────────────────────────────────────────────────────
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
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = frame / durationInFrames;

  // ── 안내방송 덕킹 + 페이드인 ──
  const annFrames = Math.ceil(announcementDurationSec * fps);
  const duckEnd = annFrames + 30;
  const fadeInFrames = Math.max(1, Math.round(audioFadeInSec * fps));

  const musicVolume = annFrames > 0
    ? interpolate(frame, [0, annFrames, duckEnd], [0.12, 0.12, 1.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : interpolate(frame, [0, fadeInFrames], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

  // ── 등장 애니메이션 ──
  const topOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const topY = interpolate(frame, [0, 20], [-24, 0], { extrapolateRight: 'clamp' });
  const bottomOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const bottomY = interpolate(frame, [10, 30], [24, 0], { extrapolateRight: 'clamp' });

  // ── 쿠폰 루프 애니메이션 ──
  const couponStart = duckEnd + 15;
  const COUPON_CYCLE = 120;
  const loopFrame = coupon && frame >= couponStart
    ? (frame - couponStart) % COUPON_CYCLE
    : 0;
  const couponOpacity = coupon && frame >= couponStart
    ? interpolate(loopFrame, [0, 20, 100, 120], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const couponY = coupon && frame >= couponStart
    ? interpolate(loopFrame, [0, 20, 100, 120], [40, 0, 0, 40], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const couponScale = coupon && frame >= couponStart
    ? interpolate(loopFrame, [18, 24, 30], [0.95, 1.04, 1.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  // ── 요소 위치 ──
  const VH = 1280;
  const headerTopPx = ((elementPositions?.headerTop ?? 8)  / 100) * VH;
  const infoTopPx   = ((elementPositions?.infoTop   ?? 72) / 100) * VH;
  const couponTopPx = ((elementPositions?.couponTop  ?? 62) / 100) * VH;

  const discountLabel = coupon
    ? coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% 할인`
      : `${coupon.discount_value.toLocaleString()}원 할인`
    : '';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', fontFamily: 'sans-serif' }}>
      <Audio src={audioUrl} startFrom={Math.round(startTimeSec * fps)} volume={musicVolume} />
      {announcementUrl && <Audio src={announcementUrl} volume={1.0} />}

      {/* 배경 */}
      <AbsoluteFill>
        {bgVideoUrl ? (
          // 배경 동영상: 음원 길이(30초/900프레임)만큼 루프
          <Loop durationInFrames={bgVideoDurationSec ? Math.max(1, Math.round(bgVideoDurationSec * fps)) : durationInFrames}>
            <OffthreadVideo
              src={bgVideoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
            />
          </Loop>
        ) : coverUrl ? (
          <Img src={coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 200 }}>
            {coverEmoji}
          </div>
        )}
      </AbsoluteFill>

      {/* 그라데이션 오버레이 */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.15) 52%, rgba(0,0,0,0.82) 100%)' }} />

      {/* 상단: 쇼츠 제목 + 강조 문구 */}
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

      {/* 쿠폰 카드 */}
      {coupon && (
        <div style={{ position: 'absolute', top: couponTopPx, left: 40, right: 40, opacity: couponOpacity, transform: `translateY(${couponY}px) scale(${couponScale})` }}>
          <div style={{ width: '100%', background: 'linear-gradient(135deg, rgba(255,111,15,0.95) 0%, rgba(255,80,0,0.95) 100%)', borderRadius: 24, padding: '22px 32px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 40px rgba(255,111,15,0.5)', border: '1.5px solid rgba(255,255,255,0.25)' }}>
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

      {/* 곡 정보 + 파형 */}
      <div style={{ position: 'absolute', top: infoTopPx, left: 52, right: 52, opacity: bottomOpacity, transform: `translateY(${bottomY}px)` }}>
        <Waveform style={waveformStyle} frame={frame} />

        <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, lineHeight: 1.3, textShadow: '0 2px 12px rgba(0,0,0,0.9)', maxWidth: 560 }}>
          🎵 {title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 22, fontWeight: 500, marginTop: 6, textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>
          {artist}
        </div>

        {moodTags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {moodTags.slice(0, 3).map((tag) => (
              <div key={tag} style={{ background: 'rgba(255,111,15,0.28)', border: '1px solid rgba(255,111,15,0.45)', borderRadius: 20, padding: '3px 13px', fontSize: 18, color: '#FF9F4F' }}>
                #{tag}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 진행 바 */}
      <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 70 }}>
        <div style={{ width: 640, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: '#FF6F0F', borderRadius: 2 }} />
        </div>
      </AbsoluteFill>

      {/* 브랜드 로고 */}
      <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'flex-end', padding: '52px 52px 0 0', opacity: topOpacity }}>
        <div style={{ background: 'rgba(255,111,15,0.9)', borderRadius: 14, padding: '7px 16px', fontSize: 22, fontWeight: 800, color: '#fff' }}>
          언니픽
        </div>
      </AbsoluteFill>

      {/* 안내방송 인디케이터 */}
      {announcementUrl && annFrames > 0 && frame < annFrames && (
        <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'flex-start', padding: '52px 0 0 52px' }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 30, padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(8px)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6F0F', opacity: Math.sin(frame / 8) * 0.5 + 0.5 }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: 600 }}>안내방송 중</span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
