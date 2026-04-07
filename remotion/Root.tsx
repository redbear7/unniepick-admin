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
          storeAddress: '서울시 강남구',
          storePhone: '02-1234-5678',
          storeCategory: '카테고리',
          storeImageUrl: '',
          template: 'modern',
        }}
      />
    </>
  );
};
