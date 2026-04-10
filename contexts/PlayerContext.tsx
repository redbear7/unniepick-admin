'use client';

import {
  createContext, useContext, useRef, useState, useCallback,
  useEffect, ReactNode,
} from 'react';
import { Howl } from 'howler';

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
  mood_tags?:      string[];
  energy_score?:   number | null;
  valence_score?:  number | null;
  danceability_score?: number | null;
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
  annVolume:   number;
  shuffle:     boolean;
  repeat:      'none' | 'one' | 'all';
  announcementPlaying: boolean;
  lastTrack:          PlayableTrack | null;
  error:              string | null;
  bassLevel:          number;
  bassSpeed:          number;
  bassFreqBand:       number;
  setBassSpeed:       (v: number) => void;
  setBassFreqBand:    (v: number) => void;

  play:               (t: PlayableTrack, q?: PlayableTrack[]) => void;
  pause:              () => void;
  resume:             () => void;
  togglePlay:         () => void;
  next:               () => void;
  prev:               () => void;
  seek:               (sec: number) => void;
  setVolume:          (v: number) => void;
  setAnnVolume:       (v: number) => void;
  toggleShuffle:      () => void;
  toggleRepeat:       () => void;
  close:              () => void;
  playAnnouncement:   (url: string, opts: { duck_volume?: number; play_mode?: 'immediate' | 'between_tracks'; ann_volume?: number }) => void;
  stopAnnouncement:   () => void;
  crossfadeSec:       3 | 4 | 5;
  setCrossfadeSec:    (v: 3 | 4 | 5) => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer must be inside PlayerProvider');
  return c;
}

// ─── Provider ─────────────────────────────────────────────────
export function PlayerProvider({ children }: { children: ReactNode }) {
  const howlRef          = useRef<Howl | null>(null);
  const nextHowlRef      = useRef<Howl | null>(null); // crossfade 다음 트랙
  const crossfadeActive  = useRef(false);
  const annAudioRef      = useRef<HTMLAudioElement | null>(null);
  const pendingAnnRef    = useRef<{ url: string; duck_volume: number } | null>(null);
  const origVolRef       = useRef<number | null>(null);
  const rafRef           = useRef<number>(0);
  const seekRafRef       = useRef<number>(0);
  const onAudioErrorRef  = useRef<(() => void) | null>(null);

  const [track,               setTrack]              = useState<PlayableTrack | null>(null);
  const [queue,               setQueue]              = useState<PlayableTrack[]>([]);
  const [queueIndex,          setQueueIndex]         = useState(0);
  const [isPlaying,           setIsPlaying]          = useState(false);
  const [currentTime,         setCurrentTime]        = useState(0);
  const [duration,            setDuration]           = useState(0);
  const [volume,              setVolume_]            = useState(0.8);
  const [annVolume,           setAnnVolume_]         = useState(2.0);
  const [shuffle,             setShuffle]            = useState(false);
  const [repeat,              setRepeat]             = useState<'none' | 'one' | 'all'>('none');
  const [announcementPlaying, setAnnouncementPlaying] = useState(false);
  const [lastTrack,           setLastTrack]          = useState<PlayableTrack | null>(null);
  const [bassLevel,           setBassLevel]          = useState(0);
  const [bassSpeed,           setBassSpeed]          = useState(1.0);
  const [bassFreqBand,        setBassFreqBand]       = useState(0);
  const [error,               setError]              = useState<string | null>(null);
  const [crossfadeSec,        setCrossfadeSec]       = useState<3 | 4 | 5>(4);

  const bassSpeedRef    = useRef(1.0);
  const bassFreqRef     = useRef(0);
  const crossfadeSecRef = useRef<number>(4);
  const volumeRef       = useRef(0.8);
  const queueRef        = useRef<PlayableTrack[]>([]);
  const queueIdxRef     = useRef(0);
  const shuffleRef      = useRef(false);
  const repeatRef       = useRef<'none' | 'one' | 'all'>('none');

  useEffect(() => { crossfadeSecRef.current = crossfadeSec; }, [crossfadeSec]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIdxRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // lastTrack 복원
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('player_last_track') ?? 'null');
      if (saved) setLastTrack(saved);
    } catch {}
  }, []);

  // 에러 자동 소거
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const setBassSpeedWrap = useCallback((v: number) => {
    setBassSpeed(v); bassSpeedRef.current = v;
  }, []);
  const setBassFreqWrap = useCallback((v: number) => {
    setBassFreqBand(v); bassFreqRef.current = v;
  }, []);

  // 베이스 시뮬레이션
  const FREQ_PRESETS: [number, number][][] = [
    [[0.8,0.4],[1.3,0.3],[0.5,0.2],[2.0,0.1]],
    [[1.5,0.35],[2.5,0.25],[1.0,0.2],[3.5,0.15],[4.5,0.05]],
    [[2.2,0.3],[3.7,0.25],[1.1,0.2],[5.3,0.15],[7.0,0.1]],
    [[4.0,0.3],[6.5,0.25],[3.0,0.2],[8.0,0.15],[10.0,0.1]],
    [[7.0,0.25],[11.0,0.25],[5.5,0.2],[14.0,0.15],[18.0,0.15]],
  ];

  const startBassAnalysis = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      const s    = bassSpeedRef.current;
      const band = Math.round(bassFreqRef.current);
      const preset = FREQ_PRESETS[band] || FREQ_PRESETS[2];
      const t = performance.now() / 1000 * s;
      let pulse = 0;
      for (const [freq, weight] of preset) pulse += Math.sin(t * freq) * weight;
      pulse += Math.random() * 0.08;
      setBassLevel(Math.max(0, Math.min(1, 0.5 + pulse)));
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, []);

  const stopBassAnalysis = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setBassLevel(0);
  }, []);

  // currentTime polling (Howler는 ontimeupdate 없음)
  const startSeekPoll = useCallback((howl: Howl) => {
    cancelAnimationFrame(seekRafRef.current);
    const poll = () => {
      if (howl.playing()) {
        setCurrentTime(howl.seek() as number);
        seekRafRef.current = requestAnimationFrame(poll);
      }
    };
    seekRafRef.current = requestAnimationFrame(poll);
  }, []);

  const stopSeekPoll = useCallback(() => {
    cancelAnimationFrame(seekRafRef.current);
  }, []);

  // 다음 트랙 인덱스 결정
  const getNextIndex = useCallback((curIdx: number, q: PlayableTrack[], sh: boolean, rep: 'none' | 'one' | 'all'): number | null => {
    if (rep === 'one' && !sh) return curIdx;
    let next = sh ? Math.floor(Math.random() * q.length) : curIdx + 1;
    if (next >= q.length) {
      if (rep === 'all') next = 0;
      else return null;
    }
    return next;
  }, []);

  // Howl 생성 + 재생
  const loadAndPlay = useCallback((t: PlayableTrack, startVol?: number) => {
    crossfadeActive.current = false;
    nextHowlRef.current?.unload();
    nextHowlRef.current = null;
    howlRef.current?.unload();
    stopBassAnalysis();
    stopSeekPoll();
    setError(null);

    const vol = startVol ?? volumeRef.current;

    const howl = new Howl({
      src: [t.audio_url],
      html5: true,
      volume: vol,
      onload: () => {
        setDuration(howl.duration());
      },
      onplay: () => {
        setIsPlaying(true);
        startBassAnalysis();
        startSeekPoll(howl);
      },
      onpause: () => {
        setIsPlaying(false);
        stopBassAnalysis();
        stopSeekPoll();
      },
      onstop: () => {
        setIsPlaying(false);
        stopBassAnalysis();
        stopSeekPoll();
      },
      onend: () => {
        if (crossfadeActive.current) return;

        // 곡간 안내방송
        const pending = pendingAnnRef.current;
        if (pending) {
          pendingAnnRef.current = null;
          setAnnouncementPlaying(true);
          const ann = new Audio(pending.url);
          annAudioRef.current = ann;
          ann.play().catch(() => {});
          ann.onended = () => {
            annAudioRef.current = null;
            setAnnouncementPlaying(false);
            const nextIdx = getNextIndex(queueIdxRef.current, queueRef.current, shuffleRef.current, repeatRef.current);
            if (nextIdx !== null && queueRef.current[nextIdx]) {
              setQueueIndex(nextIdx);
              loadAndPlay(queueRef.current[nextIdx]);
            } else {
              setIsPlaying(false);
            }
          };
          return;
        }

        const nextIdx = getNextIndex(queueIdxRef.current, queueRef.current, shuffleRef.current, repeatRef.current);
        if (nextIdx === null) { setIsPlaying(false); return; }
        setQueueIndex(nextIdx);
        loadAndPlay(queueRef.current[nextIdx]);
      },
      onerror: () => {
        console.error('[Howler] load error:', t.audio_url);
        setError(`재생 불가: "${t.title}" — 파일 없음`);
        setIsPlaying(false);
        setTimeout(() => { onAudioErrorRef.current?.(); }, 2000);
      },
    });

    howlRef.current = howl;
    setTrack(t);
    setLastTrack(t);
    setCurrentTime(0);
    setDuration(t.duration_sec ?? 0);
    try { localStorage.setItem('player_last_track', JSON.stringify(t)); } catch {}

    onAudioErrorRef.current = () => {
      const nextIdx = getNextIndex(queueIdxRef.current, queueRef.current, shuffleRef.current, repeatRef.current);
      if (nextIdx !== null && queueRef.current[nextIdx]) {
        setQueueIndex(nextIdx);
        loadAndPlay(queueRef.current[nextIdx]);
      }
    };

    howl.play();
  }, [startBassAnalysis, stopBassAnalysis, startSeekPoll, stopSeekPoll, getNextIndex]);

  // Crossfade: currentTime이 종료 N초 전이면 다음 트랙 페이드인
  useEffect(() => {
    const cf = crossfadeSecRef.current;
    if (!isPlaying || !duration || duration < cf + 2) return;
    if (currentTime < duration - cf) return;
    if (crossfadeActive.current) return;
    if (repeat === 'one' && !shuffle) return;

    const nextIdx = getNextIndex(queueIndex, queue, shuffle, repeat);
    if (nextIdx === null) return;
    const nextTrack = queue[nextIdx];
    if (!nextTrack) return;

    crossfadeActive.current = true;
    const fadeMs = cf * 1000;

    // 현재 트랙 페이드아웃
    howlRef.current?.fade(volumeRef.current, 0, fadeMs);

    // 다음 트랙 페이드인
    const nextHowl = new Howl({
      src: [nextTrack.audio_url],
      html5: true,
      volume: 0,
      onplay: () => {
        nextHowl.fade(0, volumeRef.current, fadeMs);
      },
    });
    nextHowlRef.current = nextHowl;
    nextHowl.play();

    setTimeout(() => {
      if (!crossfadeActive.current) return;
      howlRef.current?.unload();
      howlRef.current = nextHowlRef.current;
      nextHowlRef.current = null;
      crossfadeActive.current = false;
      setTrack(nextTrack);
      setLastTrack(nextTrack);
      setQueueIndex(nextIdx);
      setCurrentTime(0);
      setDuration(nextTrack.duration_sec ?? 0);
      try { localStorage.setItem('player_last_track', JSON.stringify(nextTrack)); } catch {}
      startBassAnalysis();
      startSeekPoll(howlRef.current!);

      // onend 재등록
      howlRef.current?.on('end', () => {
        const ni = getNextIndex(nextIdx, queueRef.current, shuffleRef.current, repeatRef.current);
        if (ni === null) { setIsPlaying(false); return; }
        setQueueIndex(ni);
        loadAndPlay(queueRef.current[ni]);
      });
    }, fadeMs);
  }, [currentTime, duration, isPlaying, queue, queueIndex, repeat, shuffle, getNextIndex, startBassAnalysis, startSeekPoll, loadAndPlay]);

  const play = useCallback((t: PlayableTrack, q?: PlayableTrack[]) => {
    const newQueue = q ?? [t];
    const idx = newQueue.findIndex(x => x.id === t.id);
    setQueue(newQueue);
    setQueueIndex(idx >= 0 ? idx : 0);
    loadAndPlay(t);
  }, [loadAndPlay]);

  const pause = useCallback(() => {
    howlRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    howlRef.current?.play();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause(); else resume();
  }, [isPlaying, pause, resume]);

  const next = useCallback(() => {
    const idx = getNextIndex(queueIndex, queue, shuffle, repeat) ?? queue.length - 1;
    setQueueIndex(idx);
    loadAndPlay(queue[idx]);
  }, [queue, queueIndex, shuffle, repeat, getNextIndex, loadAndPlay]);

  const prev = useCallback(() => {
    if (howlRef.current && (howlRef.current.seek() as number) > 3) {
      howlRef.current.seek(0);
      setCurrentTime(0);
      return;
    }
    const idx = Math.max(0, queueIndex - 1);
    setQueueIndex(idx);
    loadAndPlay(queue[idx]);
  }, [queue, queueIndex, loadAndPlay]);

  const seek = useCallback((sec: number) => {
    howlRef.current?.seek(sec);
    setCurrentTime(sec);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolume_(v);
    volumeRef.current = v;
    if (howlRef.current) howlRef.current.volume(v);
  }, []);

  // ── Web Audio (안내방송 GainNode 증폭) ──────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const annGainRef  = useRef<GainNode | null>(null);
  function getAudioCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }

  const setAnnVolume = useCallback((v: number) => {
    setAnnVolume_(v);
    if (annGainRef.current) annGainRef.current.gain.value = v;
    else if (annAudioRef.current) annAudioRef.current.volume = Math.min(1, v);
  }, []);

  // 볼륨 페이드 (안내방송용 HTMLAudioElement)
  const fadeVolume = useCallback((audio: HTMLAudioElement, from: number, to: number, ms: number): Promise<void> =>
    new Promise(resolve => {
      const steps = 30, stepTime = ms / steps, diff = (to - from) / steps;
      let step = 0;
      const id = setInterval(() => {
        step++;
        audio.volume = Math.min(1, Math.max(0, from + diff * step));
        if (step >= steps) { clearInterval(id); resolve(); }
      }, stepTime);
    }), []);

  const playAnnouncement = useCallback((url: string, opts: { duck_volume?: number; play_mode?: 'immediate' | 'between_tracks'; ann_volume?: number }) => {
    const duckVol  = (opts.duck_volume ?? 20) / 100;
    const playMode = opts.play_mode ?? 'immediate';
    const annVol   = annVolume;

    if (playMode === 'between_tracks') {
      pendingAnnRef.current = { url, duck_volume: duckVol };
      return;
    }

    if (origVolRef.current === null) origVolRef.current = volumeRef.current;
    const origVol = origVolRef.current;

    annAudioRef.current?.pause();
    const ann = new Audio(url);
    ann.crossOrigin = 'anonymous';
    ann.volume = 1.0;
    annAudioRef.current = ann;
    setAnnouncementPlaying(true);

    try {
      const ctx = getAudioCtx();
      const source = ctx.createMediaElementSource(ann);
      const gain = ctx.createGain();
      gain.gain.value = annVol;
      source.connect(gain).connect(ctx.destination);
      annGainRef.current = gain;
    } catch {}

    (async () => {
      try {
        if (howlRef.current) howlRef.current.fade(volumeRef.current, duckVol, 800);
        await new Promise<void>(resolve => {
          ann.onended = () => resolve();
          ann.onerror = () => resolve();
          ann.play().catch(() => resolve());
        });
        if (howlRef.current) howlRef.current.fade(howlRef.current.volume() as number, origVol, 800);
      } finally {
        if (howlRef.current) howlRef.current.volume(origVol);
        origVolRef.current = null;
        annAudioRef.current = null;
        annGainRef.current = null;
        setAnnouncementPlaying(false);
      }
    })();
  }, [annVolume, fadeVolume]);

  const stopAnnouncement = useCallback(() => {
    if (!annAudioRef.current) return;
    annAudioRef.current.pause();
    annAudioRef.current = null;
    annGainRef.current = null;
    if (howlRef.current && origVolRef.current !== null) {
      howlRef.current.volume(origVolRef.current);
    }
    origVolRef.current = null;
    setAnnouncementPlaying(false);
  }, []);

  const close = useCallback(() => {
    howlRef.current?.unload();
    howlRef.current = null;
    stopBassAnalysis();
    stopSeekPoll();
    setTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [stopBassAnalysis, stopSeekPoll]);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const toggleRepeat  = useCallback(() => setRepeat(r =>
    r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'
  ), []);

  return (
    <Ctx.Provider value={{
      track, queue, queueIndex, isPlaying,
      currentTime, duration, volume, annVolume, shuffle, repeat,
      announcementPlaying, lastTrack, error,
      bassLevel, bassSpeed, bassFreqBand,
      setBassSpeed: setBassSpeedWrap, setBassFreqBand: setBassFreqWrap,
      play, pause, resume, togglePlay,
      next, prev, seek, setVolume, setAnnVolume,
      toggleShuffle, toggleRepeat, close,
      playAnnouncement, stopAnnouncement,
      crossfadeSec, setCrossfadeSec,
    }}>
      {children}
    </Ctx.Provider>
  );
}
