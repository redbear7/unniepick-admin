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
  bassLevel:          number;  // 0~1 베이스 주파수 강도
  bassSpeed:          number;  // 펄스 속도 배율 0.3~3
  bassFreqBand:       number;  // 주파수 대역 0=서브베이스 ~ 4=고음
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
}

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePlayer must be inside PlayerProvider');
  return c;
}

// ─── Provider ─────────────────────────────────────────────────
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const annAudioRef      = useRef<HTMLAudioElement | null>(null);
  const pendingAnnRef    = useRef<{ url: string; duck_volume: number } | null>(null); // 곡간 삽입 대기
  const origVolRef       = useRef<number | null>(null); // 안내방송 전 원본 트랙 볼륨

  // ── 베이스 분석 (시뮬레이션 — Web Audio 연결 없이 재생에 영향 없음) ──
  const rafRef           = useRef<number>(0);

  const [track,               setTrack]              = useState<PlayableTrack | null>(null);
  const [queue,               setQueue]              = useState<PlayableTrack[]>([]);
  const [queueIndex,          setQueueIndex]         = useState(0);
  const [isPlaying,           setIsPlaying]          = useState(false);
  const [currentTime,         setCurrentTime]        = useState(0);
  const [duration,            setDuration]           = useState(0);
  const [volume,              setVolume_]            = useState(0.8);
  const [annVolume,           setAnnVolume_]         = useState(2.0); // 내부 0~2 (GainNode 증폭), UI에는 0~100%로 표시
  const [shuffle,             setShuffle]            = useState(false);
  const [repeat,              setRepeat]             = useState<'none' | 'one' | 'all'>('none');
  const [announcementPlaying, setAnnouncementPlaying] = useState(false);
  const [lastTrack, setLastTrack] = useState<PlayableTrack | null>(null);
  const [bassLevel, setBassLevel] = useState(0);
  const [bassSpeed, setBassSpeed] = useState(1.0);
  const [bassFreqBand, setBassFreqBand] = useState(0); // 0~4
  const bassSpeedRef = useRef(1.0);
  const bassFreqRef  = useRef(0);

  // localStorage → lastTrack 복원 (클라이언트 마운트 후)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('player_last_track') ?? 'null');
      if (saved) setLastTrack(saved);
    } catch {}
  }, []);

  const [error, setError] = useState<string | null>(null);

  // Audio 이벤트 바인딩 (onended는 useEffect에서 처리)
  const bindAudio = useCallback((audio: HTMLAudioElement, trackTitle: string) => {
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.ondurationchange = () => setDuration(audio.duration || 0);
    audio.onerror = () => {
      console.error('[Player] audio load error:', audio.src);
      setError(`재생 불가: "${trackTitle}" — 서버에 오디오 파일이 없습니다`);
      setIsPlaying(false);
    };
  }, []);

  // 에러 자동 소거 (5초)
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const setBassSpeedWrap = useCallback((v: number) => {
    setBassSpeed(v);
    bassSpeedRef.current = v;
  }, []);
  const setBassFreqWrap = useCallback((v: number) => {
    setBassFreqBand(v);
    bassFreqRef.current = v;
  }, []);

  // 주파수 대역별 사인파 프리셋 [진동수, 가중치][]
  // 0=서브베이스(느리고 무거움) → 4=고음(빠르고 날카로움)
  const FREQ_PRESETS: [number, number][][] = [
    /* 0: Sub Bass   */ [[0.8, 0.4], [1.3, 0.3], [0.5, 0.2], [2.0, 0.1]],
    /* 1: Bass       */ [[1.5, 0.35], [2.5, 0.25], [1.0, 0.2], [3.5, 0.15], [4.5, 0.05]],
    /* 2: Low-Mid    */ [[2.2, 0.3], [3.7, 0.25], [1.1, 0.2], [5.3, 0.15], [7.0, 0.1]],
    /* 3: Mid        */ [[4.0, 0.3], [6.5, 0.25], [3.0, 0.2], [8.0, 0.15], [10.0, 0.1]],
    /* 4: High       */ [[7.0, 0.25], [11.0, 0.25], [5.5, 0.2], [14.0, 0.15], [18.0, 0.15]],
  ];

  // 베이스 시뮬레이션: 대역별 사인파 합성
  const startBassAnalysis = useCallback((_audio: HTMLAudioElement) => {
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      const s = bassSpeedRef.current;
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

  // 특정 트랙 로드+재생
  const loadAndPlay = useCallback((t: PlayableTrack) => {
    audioRef.current?.pause();
    stopBassAnalysis();
    setError(null);

    const audio = new Audio(t.audio_url);
    audio.volume = volume;
    bindAudio(audio, t.title);
    audioRef.current = audio;
    setTrack(t);
    setLastTrack(t);
    try { localStorage.setItem('player_last_track', JSON.stringify(t)); } catch {}
    setCurrentTime(0);
    setDuration(t.duration_sec ?? 0);
    audio.play()
      .then(() => {
        console.log('[Player] ▶', t.title);
        setIsPlaying(true);
        startBassAnalysis(audio);
      })
      .catch((e) => { console.error('[Player] play failed:', e.message); setIsPlaying(false); });
  }, [volume, bindAudio, startBassAnalysis, stopBassAnalysis]);

  // ended → 자동 다음 트랙
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      const pending = pendingAnnRef.current;
      if (pending) {
        pendingAnnRef.current = null;
        // 안내방송 재생 후 다음 트랙
        setAnnouncementPlaying(true);
        const ann = new Audio(pending.url);
        annAudioRef.current = ann;
        ann.play().catch(() => {});
        ann.onended = () => {
          annAudioRef.current = null;
          setAnnouncementPlaying(false);
          setQueueIndex(prev => {
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
        return;
      }
      setQueueIndex(prev => {
        // 셔플 ON 이면 1곡 반복 무시 → 랜덤 다음 트랙
        if (repeat === 'one' && !shuffle) {
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
    stopBassAnalysis();
  }, [stopBassAnalysis]);

  const resume = useCallback(() => {
    audioRef.current?.play().then(() => {
      setIsPlaying(true);
      if (audioRef.current) startBassAnalysis(audioRef.current);
    }).catch(() => {});
  }, [startBassAnalysis]);

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

  const setAnnVolume = useCallback((v: number) => {
    setAnnVolume_(v);
    if (annGainRef.current) {
      // GainNode로 증폭 — audio.volume은 1.0 고정
      annGainRef.current.gain.value = v;
    } else if (annAudioRef.current) {
      // GainNode 없으면 audio.volume fallback (최대 1.0)
      annAudioRef.current.volume = Math.min(1, v);
    }
  }, []);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const toggleRepeat  = useCallback(() => setRepeat(r =>
    r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'
  ), []);

  // ── 볼륨 페이드 헬퍼 ─────────────────────────────────────────
  const fadeVolume = (audio: HTMLAudioElement, from: number, to: number, ms: number): Promise<void> =>
    new Promise(resolve => {
      const steps    = 30;
      const stepTime = ms / steps;
      const diff     = (to - from) / steps;
      let step = 0;
      const id = setInterval(() => {
        step++;
        audio.volume = Math.min(1, Math.max(0, from + diff * step));
        if (step >= steps) { clearInterval(id); resolve(); }
      }, stepTime);
    });

  // ── Web Audio Context (안내방송 볼륨 1.0 초과 증폭용) ──────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const annGainRef  = useRef<GainNode | null>(null);

  function getAudioCtx() {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }

  // ── 안내방송 실행 ─────────────────────────────────────────────
  const playAnnouncement = useCallback((url: string, opts: { duck_volume?: number; play_mode?: 'immediate' | 'between_tracks'; ann_volume?: number }) => {
    const duckVol   = (opts.duck_volume ?? 20) / 100;
    const play_mode = opts.play_mode ?? 'immediate';
    const annVolRatio = annVolume; // GainNode 증폭값 (1.2 = 120%)

    if (play_mode === 'between_tracks') {
      pendingAnnRef.current = { url, duck_volume: duckVol };
      return;
    }

    // 즉시 방송: 페이드 아웃 → 안내 → 페이드 인
    const trackAudio = audioRef.current;

    // 이미 안내방송 중이면 origVol 보존, 아니면 현재 트랙 볼륨을 기록
    if (origVolRef.current === null) {
      origVolRef.current = trackAudio ? trackAudio.volume : volume;
    }
    const origVol = origVolRef.current;

    // 이전 안내방송 즉시 중단
    annAudioRef.current?.pause();

    const ann = new Audio(url);
    ann.crossOrigin = 'anonymous';
    ann.volume = 1.0; // GainNode에서 증폭 제어, audio.volume은 1.0 고정
    annAudioRef.current = ann;
    setAnnouncementPlaying(true);

    // Web Audio GainNode로 1.0 초과 증폭
    try {
      const ctx = getAudioCtx();
      const source = ctx.createMediaElementSource(ann);
      const gain = ctx.createGain();
      gain.gain.value = annVolRatio; // 1.2 = 120% 증폭
      source.connect(gain).connect(ctx.destination);
      annGainRef.current = gain;
    } catch {
      // Web Audio 미지원 시 fallback: HTML volume만 사용
    }

    (async () => {
      try {
        if (trackAudio) await fadeVolume(trackAudio, trackAudio.volume, duckVol, 800);
        await new Promise<void>(resolve => {
          ann.onended = () => resolve();
          ann.onerror = () => resolve();
          ann.play().catch(() => resolve());
        });
        const target = audioRef.current ?? trackAudio;
        if (target) await fadeVolume(target, target.volume, origVol, 800);
      } finally {
        const target = audioRef.current ?? trackAudio;
        if (target) target.volume = origVol;
        origVolRef.current = null;
        annAudioRef.current = null;
        annGainRef.current = null;
        setAnnouncementPlaying(false);
      }
    })();
  }, [volume, annVolume]);

  const close = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    stopBassAnalysis();
    setTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [stopBassAnalysis]);

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
      playAnnouncement,
    }}>
      {children}
    </Ctx.Provider>
  );
}
