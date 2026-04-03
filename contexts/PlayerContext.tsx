'use client';

import {
  createContext, useContext, useRef, useState, useCallback,
  useEffect, ReactNode,
} from 'react';

// ─── 공유 트랙 타입 ────────────────────────────────────────────
export interface PlayableTrack {
  id:              string;
  title:           string;
  artist:          string;
  audio_url:       string;
  cover_image_url?: string | null;
  cover_emoji?:    string;
  duration_sec?:   number | null;
  mood?:           string;
}

// ─── Context 타입 ──────────────────────────────────────────────
interface PlayerCtx {
  track:       PlayableTrack | null;
  queue:       PlayableTrack[];
  queueIndex:  number;
  isPlaying:   boolean;
  currentTime: number;
  duration:    number;
  volume:      number;
  shuffle:     boolean;
  repeat:      'none' | 'one' | 'all';

  play:          (t: PlayableTrack, q?: PlayableTrack[]) => void;
  pause:         () => void;
  resume:        () => void;
  togglePlay:    () => void;
  next:          () => void;
  prev:          () => void;
  seek:          (sec: number) => void;
  setVolume:     (v: number) => void;
  toggleShuffle: () => void;
  toggleRepeat:  () => void;
  close:         () => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer must be inside PlayerProvider');
  return c;
}

// ─── Provider ─────────────────────────────────────────────────
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef   = useRef<HTMLAudioElement | null>(null);

  const [track,       setTrack]      = useState<PlayableTrack | null>(null);
  const [queue,       setQueue]      = useState<PlayableTrack[]>([]);
  const [queueIndex,  setQueueIndex] = useState(0);
  const [isPlaying,   setIsPlaying]  = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]   = useState(0);
  const [volume,      setVolume_]    = useState(0.8);
  const [shuffle,     setShuffle]    = useState(false);
  const [repeat,      setRepeat]     = useState<'none' | 'one' | 'all'>('none');

  // Audio 이벤트 바인딩
  const bindAudio = useCallback((audio: HTMLAudioElement) => {
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.ondurationchange = () => setDuration(audio.duration || 0);
    audio.onended = () => {
      setIsPlaying(false);
      // 다음 트랙 자동 재생은 repeat/shuffle 처리 후
    };
    audio.volume = volume;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 특정 트랙 로드+재생
  const loadAndPlay = useCallback((t: PlayableTrack) => {
    audioRef.current?.pause();
    const audio = new Audio(t.audio_url);
    audio.volume = volume;
    bindAudio(audio);
    audio.onended = () => {
      setIsPlaying(false);
      // ended 후 next 처리는 아래 useEffect에서
    };
    audioRef.current = audio;
    setTrack(t);
    setCurrentTime(0);
    setDuration(t.duration_sec ?? 0);
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [volume, bindAudio]);

  // ended → 자동 다음 트랙
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      setQueueIndex(prev => {
        if (repeat === 'one') {
          audio.currentTime = 0;
          audio.play().then(() => setIsPlaying(true));
          return prev;
        }
        let next = prev + 1;
        if (shuffle) next = Math.floor(Math.random() * queue.length);
        if (next >= queue.length) {
          if (repeat === 'all') next = 0;
          else { setIsPlaying(false); return prev; }
        }
        loadAndPlay(queue[next]);
        return next;
      });
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [queue, repeat, shuffle, loadAndPlay]);

  const play = useCallback((t: PlayableTrack, q?: PlayableTrack[]) => {
    const newQueue = q ?? [t];
    const idx      = newQueue.findIndex(x => x.id === t.id);
    setQueue(newQueue);
    setQueueIndex(idx >= 0 ? idx : 0);
    loadAndPlay(t);
  }, [loadAndPlay]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause(); else resume();
  }, [isPlaying, pause, resume]);

  const next = useCallback(() => {
    let idx = shuffle
      ? Math.floor(Math.random() * queue.length)
      : queueIndex + 1;
    if (idx >= queue.length) idx = repeat === 'all' ? 0 : queue.length - 1;
    setQueueIndex(idx);
    loadAndPlay(queue[idx]);
  }, [queue, queueIndex, shuffle, repeat, loadAndPlay]);

  const prev = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const idx = Math.max(0, queueIndex - 1);
    setQueueIndex(idx);
    loadAndPlay(queue[idx]);
  }, [queue, queueIndex, loadAndPlay]);

  const seek = useCallback((sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      setCurrentTime(sec);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolume_(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const toggleRepeat  = useCallback(() => setRepeat(r =>
    r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'
  ), []);

  const close = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return (
    <Ctx.Provider value={{
      track, queue, queueIndex, isPlaying,
      currentTime, duration, volume, shuffle, repeat,
      play, pause, resume, togglePlay,
      next, prev, seek, setVolume,
      toggleShuffle, toggleRepeat, close,
    }}>
      {children}
    </Ctx.Provider>
  );
}
