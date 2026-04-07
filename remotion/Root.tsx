import { Composition } from 'remotion';
import { ShortsVideo } from './compositions/ShortsVideo';
import { CardNewsVideo } from './compositions/CardNewsVideo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ShortsVideoComp = ShortsVideo as React.ComponentType<any>;
const CardNewsVideoComp = CardNewsVideo as React.ComponentType<any>;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortsVideo"
        component={ShortsVideoComp}
        durationInFrames={900}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          audioUrl: '',
          coverUrl: null,
          title: '트랙 제목',
          artist: '아티스트',
          coverEmoji: '🎵',
          startTimeSec: 0,
          moodTags: [],
          shortsTitle: '',
          shortsTagline: '',
          coupon: null,
          announcementUrl: '',
          announcementDurationSec: 0,
          elementPositions: { headerTop: 8, infoTop: 72, couponTop: 62 },
          audioFadeInSec: 1.5,
          waveformStyle: 'bar',
        }}
      />
      <Composition
        id="CardNewsVideo"
        component={CardNewsVideoComp}
        durationInFrames={600}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          audioUrl: '',
          storeName: '업체명',
          cards: [
            { title: '업체 소개', content: '프리미엄 서비스를 경험하세요' },
            { title: '위치 안내', content: '서울시 강남구' },
            { title: '연락처', content: '02-1234-5678' },
            { title: '주요 메뉴', content: '대표 상품 1\n대표 상품 2\n대표 상품 3' },
            { title: '지금 방문', content: '지금 바로 문의하세요!' },
          ],
          template: 'modern' as const,
        }}
      />
    </>
  );
};
