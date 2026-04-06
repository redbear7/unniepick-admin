import { Composition } from 'remotion';
import { ShortsVideo } from './compositions/ShortsVideo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ShortsVideoComp = ShortsVideo as React.ComponentType<any>;

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
