'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Megaphone, Play, Pause, Trash2, Loader2, Volume2, ChevronDown, Radio, Plus, Pencil, BookMarked, X, Check, DatabaseZap, Bookmark } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

// ─── 타입 ──────────────────────────────────────────────────────
interface Store { id: string; name: string; }
interface Announcement {
  id:           string;
  store_id:     string;
  text:         string;
  audio_url:    string | null;
  voice_type:   string;
  play_mode:    'immediate' | 'between_tracks';
  repeat_count: number;
  is_active:    boolean;
  created_at:   string;
}

interface TtsTemplate {
  id?:          string;
  emoji:        string;
  label:        string;
  text:         string;
  voice_type:   string;
  speed:        number;
  play_mode:    'immediate' | 'between_tracks';
  repeat_count: number;
  duck_volume:  number;
  sched_days:   number[];   // 0=월 ~ 6=일, 빈 배열=매일
  sched_time:   string;     // 'HH:MM', ''=즉시
  store_id?:    string | null;
}

const DAYS_KR = ['월', '화', '수', '목', '금', '토', '일'];
const TEMPLATES_LS_KEY = 'tts_templates_admin';

const DEFAULT_FISH_VOICE = 'fish_18e99f7be5374fa9b5ae52ed2f51e80d';

const DEFAULT_TEMPLATES: TtsTemplate[] = [
  { emoji: '🎉', label: '할인 이벤트',
    text: '지금 매장에서 특별 할인 이벤트가 진행 중입니다! 오늘 하루만 전 메뉴 10% 할인, 많은 이용 부탁드립니다.',
    voice_type: DEFAULT_FISH_VOICE, speed: 1.0, play_mode: 'immediate', repeat_count: 1, duck_volume: 20,
    sched_days: [], sched_time: '' },
  { emoji: '🎟', label: '쿠폰 발급',
    text: '언니픽 앱에서 쿠폰이 새로 발급되었습니다! 지금 바로 확인하고 사용해보세요.',
    voice_type: DEFAULT_FISH_VOICE, speed: 1.0, play_mode: 'immediate', repeat_count: 1, duck_volume: 20,
    sched_days: [], sched_time: '' },
  { emoji: '⏰', label: '마감 안내',
    text: '안내 말씀 드립니다. 잠시 후 영업이 종료됩니다. 오늘도 방문해 주셔서 감사합니다.',
    voice_type: DEFAULT_FISH_VOICE, speed: 1.0, play_mode: 'between_tracks', repeat_count: 2, duck_volume: 20,
    sched_days: [0,1,2,3,4,5,6], sched_time: '21:00' },
  { emoji: '📍', label: '체크인 혜택',
    text: '언니픽 앱으로 지금 체크인하시면 특별 적립금을 드립니다! 앱을 열고 체크인 버튼을 눌러보세요.',
    voice_type: DEFAULT_FISH_VOICE, speed: 1.0, play_mode: 'immediate', repeat_count: 1, duck_volume: 20,
    sched_days: [], sched_time: '' },
  { emoji: '☕', label: '1+1 행사',
    text: '지금 이 시간, 음료 하나 사시면 하나 더 드립니다! 오늘 오후 3시까지만 진행되는 특별 행사입니다.',
    voice_type: DEFAULT_FISH_VOICE, speed: 1.0, play_mode: 'immediate', repeat_count: 3, duck_volume: 20,
    sched_days: [5,6], sched_time: '14:00' },
];

// ─── Fish Audio 성우 카드 ───────────────────────────────────────
interface FishVoice { id: string; label: string; refId: string; emoji: string; }

const FISH_VOICES_KEY  = 'fish_voices_v2';    // localStorage: FishVoice[]
const SAMPLE_CACHE_KEY = 'tts_sample_cache';  // sessionStorage: {voiceType: url}
const VOICE_EMOJIS = ['🐟','🐠','🐡','🦈','🐬','🦭','🎙️','🎤','👩','👨','🧑','🎭','🌸','🌿','⭐'];

const DEFAULT_FISH_VOICES: FishVoice[] = [
  { id: 'default_ko_male', label: '한국어 남성', refId: '18e99f7be5374fa9b5ae52ed2f51e80d', emoji: '🐟' },
];

const PLAY_MODES = [
  { value: 'immediate',      label: '즉시 방송' },
  { value: 'between_tracks', label: '곡간 삽입' },
];

const SPEED_OPTIONS    = [0.75, 1.0, 1.25, 1.5];
const AUDIO_CACHE_KEY  = 'tts_audio_cache';    // localStorage: 원본 URL
const DEFAULT_VOICE_KEY = 'tts_default_voice';
const GREETING_KEY      = 'tts_greeting';        // localStorage: 인사말 문구
const CALL_TEMPLATE_KEY = 'tts_call_template';  // localStorage: 고객호출 템플릿
const CALL_CARD_COUNT   = 20;

// ── 세션 메모리 캐시 (볼륨 처리된 Blob URL, 탭 닫으면 해제) ──────
const sessionAudioCache = new Map<string, string>(); // key → blobUrl

function sessionCacheKey(text: string, voice: string, speed: number, vol: number) {
  return `${text.trim()}__${voice}__${speed}__${vol}`;
}

// OfflineAudioContext로 볼륨 적용 후 WAV Blob URL 반환
async function applyGainAndCache(url: string, gain: number, cacheKey: string): Promise<string> {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();

  if (gain === 1) {
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const blobUrl = URL.createObjectURL(blob);
    sessionAudioCache.set(cacheKey, blobUrl);
    return blobUrl;
  }

  // 디코드
  const tmpCtx = new AudioContext();
  const audioBuffer = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  await tmpCtx.close();

  // OfflineAudioContext로 Gain 적용
  const offline = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );
  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  const gainNode = offline.createGain();
  gainNode.gain.value = gain;
  src.connect(gainNode);
  gainNode.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();

  // AudioBuffer → WAV Blob
  const numCh = rendered.numberOfChannels;
  const len   = rendered.length * numCh * 2;
  const ab    = new ArrayBuffer(44 + len);
  const dv    = new DataView(ab);
  const wr    = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + len, true);
  wr(8, 'WAVE'); wr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true); dv.setUint32(24, rendered.sampleRate, true);
  dv.setUint32(28, rendered.sampleRate * numCh * 2, true);
  dv.setUint16(32, numCh * 2, true); dv.setUint16(34, 16, true);
  wr(36, 'data'); dv.setUint32(40, len, true);
  let off = 44;
  for (let i = 0; i < rendered.length; i++)
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, rendered.getChannelData(ch)[i]));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }

  const blobUrl = URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }));
  sessionAudioCache.set(cacheKey, blobUrl);
  return blobUrl;
}

function getCachedAudio(text: string, voice: string, speed: number): string | null {
  try {
    const cache = JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY) || '{}');
    return cache[`${text.trim()}__${voice}__${speed}`] ?? null;
  } catch { return null; }
}

function setCachedAudio(text: string, voice: string, speed: number, url: string) {
  try {
    const cache = JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY) || '{}');
    cache[`${text.trim()}__${voice}__${speed}`] = url;
    localStorage.setItem(AUDIO_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const MODE_LABEL: Record<string, string> = Object.fromEntries(PLAY_MODES.map(m => [m.value, m.label]));

// ─── 컴포넌트 ───────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const sb     = createClient();
  const player = usePlayer();

  const [stores,         setStores]         = useState<Store[]>([]);
  const [selectedStore,  setSelectedStore]  = useState<string>('');
  const [announcements,  setAnnouncements]  = useState<Announcement[]>([]);
  const [loading,        setLoading]        = useState(true);

  // 인사말 (모든 문구 앞에 자동 추가)
  const [greeting,     setGreeting]     = useState('안내말씀드립니다.');
  const [greetingOn,   setGreetingOn]   = useState(true);

  // 고객 호출
  const [callOpen,       setCallOpen]       = useState(false);
  const [callTemplate,   setCallTemplate]   = useState('{num}번 고객님, 카운터로 와주세요.');
  const [callStartNum,   setCallStartNum]   = useState('');
  const [directCallNum,  setDirectCallNum]  = useState('');
  const [callingNum,     setCallingNum]     = useState<number | null>(null);
  const [callRepeat,     setCallRepeat]     = useState(1);
  const directCallRef = useRef<HTMLInputElement>(null);

  // 생성 폼
  const [text,         setText]         = useState('');
  const [defaultVoice, setDefaultVoice] = useState(DEFAULT_FISH_VOICE);
  const [voice,        setVoice]        = useState(DEFAULT_FISH_VOICE);
  const [speed,      setSpeed]      = useState(1.0);
  const [playMode,   setPlayMode]   = useState<'immediate' | 'between_tracks'>('immediate');
  const [repeat,     setRepeat]     = useState(1);
  const [duckVolume, setDuckVolume] = useState(20);
  const [annVolume,  setAnnVolume]  = useState(120); // 안내방송 볼륨 % (50~200)
  const [cacheHit,   setCacheHit]   = useState(false);

  // 템플릿
  const [templates,       setTemplates]       = useState<TtsTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTplId,   setSelectedTplId]   = useState<string | null>(null); // 선택된 템플릿 (id or idx string)
  const [tplModal,        setTplModal]        = useState(false);
  const [tplEditTarget,   setTplEditTarget]   = useState<TtsTemplate | null>(null); // null=새로 추가
  const [tplEditEmoji,    setTplEditEmoji]    = useState('');
  const [tplEditLabel,    setTplEditLabel]    = useState('');
  const [tplEditText,     setTplEditText]     = useState('');
  const [tplEditVoice,    setTplEditVoice]    = useState('female_bright');
  const [tplEditSpeed,    setTplEditSpeed]    = useState(1.0);
  const [tplEditMode,     setTplEditMode]     = useState<'immediate' | 'between_tracks'>('immediate');
  const [tplEditRepeat,   setTplEditRepeat]   = useState(1);
  const [tplEditDuck,     setTplEditDuck]     = useState(20);
  const [tplEditDays,     setTplEditDays]     = useState<number[]>([]);
  const [tplEditTime,     setTplEditTime]     = useState('');

  // 상태
  const [generating,    setGenerating]    = useState(false);
  const [deleting,      setDeleting]      = useState<string | null>(null);
  const [playingId,     setPlayingId]     = useState<string | null>(null);  // 단순 Audio 재생 중인 ID
  const [announcingId,  setAnnouncingId]  = useState<string | null>(null);  // playAnnouncement 중인 ID
  const [samplingVoice,   setSamplingVoice]   = useState<string | null>(null);
  const [playingVoice,    setPlayingVoice]    = useState<string | null>(null);
  const [voiceSamples,    setVoiceSamples]    = useState<Record<string, string>>({});
  // 성우 카드
  const [fishVoices,      setFishVoices]      = useState<FishVoice[]>(DEFAULT_FISH_VOICES);
  const [editingVoiceId,  setEditingVoiceId]  = useState<string | null>(null);
  const [addingVoice,     setAddingVoice]     = useState(false);
  const [newVoiceForm,    setNewVoiceForm]    = useState<Omit<FishVoice,'id'>>({ label: '', refId: '', emoji: '🎙️' });
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { loadStores(); loadTemplates(); }, []);
  useEffect(() => { loadAnnouncements(); }, [selectedStore]);

  // ── localStorage 초기화 (클라이언트 마운트 후) ──
  const loadTemplates = () => {
    try {
      const saved = localStorage.getItem(TEMPLATES_LS_KEY);
      if (saved) setTemplates(JSON.parse(saved));
    } catch {}
    try {
      const savedVoice = localStorage.getItem(DEFAULT_VOICE_KEY) ?? DEFAULT_FISH_VOICE;
      setDefaultVoice(savedVoice);
      setVoice(savedVoice);
    } catch {}
    try {
      const g = localStorage.getItem(GREETING_KEY);
      if (g !== null) setGreeting(g);
      else localStorage.setItem(GREETING_KEY, '안내말씀드립니다.');
    } catch {}
    try {
      const ct = localStorage.getItem(CALL_TEMPLATE_KEY);
      if (ct) setCallTemplate(ct);
    } catch {}
    try {
      const saved = localStorage.getItem(FISH_VOICES_KEY);
      if (saved) setFishVoices(JSON.parse(saved));
    } catch {}
    try {
      const cached = sessionStorage.getItem(SAMPLE_CACHE_KEY);
      if (cached) setVoiceSamples(JSON.parse(cached));
    } catch {}
  };

  const persistTemplates = useCallback((updated: TtsTemplate[]) => {
    setTemplates(updated);
    try { localStorage.setItem(TEMPLATES_LS_KEY, JSON.stringify(updated)); } catch {}
  }, []);

  // ── 텍스트/목소리/속도 변경 시 캐시 여부 확인 ──
  // localStorage + 세션 캐시(볼륨 포함) 모두 있어야 진짜 캐시 히트
  const checkCache = (t: string, v: string, s: number, vol?: number) => {
    const effectiveVol = vol ?? annVolume;
    const hasLs      = !!getCachedAudio(t, v, s);
    const hasSess    = sessionAudioCache.has(sessionCacheKey(t, v, s, effectiveVol));
    setCacheHit(hasLs && hasSess);
  };

  // ── 템플릿 선택 → 폼 채우기 ──
  const handleSelectTemplate = (tpl: TtsTemplate, key: string) => {
    if (selectedTplId === key) { setSelectedTplId(null); return; }
    setSelectedTplId(key);
    setText(tpl.text);
    setVoice(tpl.voice_type);
    setSpeed(tpl.speed);
    setPlayMode(tpl.play_mode);
    setRepeat(tpl.repeat_count);
    setDuckVolume(tpl.duck_volume);
    checkCache(tpl.text, tpl.voice_type, tpl.speed);
  };

  // ── 현재 폼 → 선택 템플릿 저장 ──
  const handleSaveToTemplate = () => {
    if (!selectedTplId) return;
    const updated = templates.map((t, i) =>
      `${i}` === selectedTplId
        ? { ...t, text, voice_type: voice, speed, play_mode: playMode, repeat_count: repeat, duck_volume: duckVolume }
        : t
    );
    persistTemplates(updated);
  };

  // ── 템플릿 편집 모달 열기 ──
  const openTplModal = (tpl: TtsTemplate | null, idx?: number) => {
    setTplEditTarget(tpl);
    if (tpl) {
      setTplEditEmoji(tpl.emoji);
      setTplEditLabel(tpl.label);
      setTplEditText(tpl.text);
      setTplEditVoice(tpl.voice_type);
      setTplEditSpeed(tpl.speed);
      setTplEditMode(tpl.play_mode);
      setTplEditRepeat(tpl.repeat_count);
      setTplEditDuck(tpl.duck_volume);
      setTplEditDays(tpl.sched_days ?? []);
      setTplEditTime(tpl.sched_time ?? '');
    } else {
      setTplEditEmoji('📢');
      setTplEditLabel('');
      setTplEditText('');
      setTplEditVoice(DEFAULT_FISH_VOICE);
      setTplEditSpeed(1.0);
      setTplEditMode('immediate');
      setTplEditRepeat(1);
      setTplEditDuck(20);
      setTplEditDays([]);
      setTplEditTime('');
    }
    setTplModal(true);
  };

  const handleConfirmTplEdit = () => {
    if (!tplEditLabel.trim() || !tplEditText.trim()) { alert('라벨과 문구를 입력하세요'); return; }
    const newTpl: TtsTemplate = {
      emoji: tplEditEmoji.trim() || '📢',
      label: tplEditLabel.trim(),
      text: tplEditText.trim(),
      voice_type: tplEditVoice,
      speed: tplEditSpeed,
      play_mode: tplEditMode,
      repeat_count: tplEditRepeat,
      duck_volume: tplEditDuck,
      sched_days: tplEditDays,
      sched_time: tplEditTime.trim(),
    };
    const updated = tplEditTarget === null
      ? [...templates, newTpl]
      : templates.map(t => t === tplEditTarget ? newTpl : t);
    persistTemplates(updated);
    setTplModal(false);
  };

  const handleDeleteTemplate = (tpl: TtsTemplate) => {
    if (!confirm(`"${tpl.label}" 템플릿을 삭제할까요?`)) return;
    const updated = templates.filter(t => t !== tpl);
    persistTemplates(updated);
    setTplModal(false);
    setSelectedTplId(null);
  };

  const toggleTplDay = (d: number) => {
    setTplEditDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const loadStores = async () => {
    const { data } = await sb.from('stores').select('id, name').order('name');
    setStores(data ?? []);
  };

  const loadAnnouncements = async () => {
    setLoading(true);
    let q = sb.from('store_announcements').select('*').order('created_at', { ascending: false });
    if (selectedStore) q = q.eq('store_id', selectedStore);
    const { data } = await q;
    setAnnouncements((data ?? []) as Announcement[]);
    setLoading(false);
  };

  // 목소리 샘플 미리듣기
  const handleVoiceSample = async (rawVoiceType: string) => {
    const voiceType = resolvedVoice(rawVoiceType);
    // 이미 재생 중이면 정지
    if (playingVoice === voiceType) {
      sampleAudioRef.current?.pause();
      sampleAudioRef.current = null;
      setPlayingVoice(null);
      return;
    }
    // 캐시된 샘플 있으면 바로 재생
    if (voiceSamples[voiceType]) {
      sampleAudioRef.current?.pause();
      const a = new Audio(voiceSamples[voiceType]);
      sampleAudioRef.current = a;
      a.play();
      setPlayingVoice(voiceType);
      a.onended = () => { sampleAudioRef.current = null; setPlayingVoice(null); };
      return;
    }
    // 샘플 생성
    setSamplingVoice(voiceType);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '안녕하세요! 언니픽 매장 안내방송입니다.', voice_type: voiceType, speed: 1.0, store_id: null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVoiceSamples(prev => {
        const next = { ...prev, [voiceType]: data.audio_url };
        try { sessionStorage.setItem(SAMPLE_CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
      sampleAudioRef.current?.pause();
      const a = new Audio(data.audio_url);
      sampleAudioRef.current = a;
      a.play();
      setPlayingVoice(voiceType);
      a.onended = () => { sampleAudioRef.current = null; setPlayingVoice(null); };
    } catch (e: any) {
      alert(`샘플 생성 실패: ${e.message}`);
    } finally {
      setSamplingVoice(null);
    }
  };

  // 성우 카드 저장
  const saveFishVoices = (updated: FishVoice[]) => {
    setFishVoices(updated);
    try { localStorage.setItem(FISH_VOICES_KEY, JSON.stringify(updated)); } catch {}
  };

  // voice_type은 항상 'fish_<refId>' 형태로 직접 저장되므로 변환 불필요
  const resolvedVoice = (v: string) => v;

  // 고객 번호 호출 TTS 생성 및 즉시 재생
  const handleCallNum = async (num: number) => {
    if (callingNum !== null) return;
    if (!voice) { alert('성우를 먼저 선택하세요'); return; }
    setCallingNum(num);
    const callText  = callTemplate.replace('{num}', String(num));
    const prefix    = greetingOn && greeting.trim() ? `${greeting.trim()} ` : '';
    const fullText  = `${prefix}${callText}`;
    try {
      let audioUrl: string;
      const cached = getCachedAudio(fullText, voice, speed);
      if (cached) {
        audioUrl = cached;
      } else {
        const res = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, voice_type: voice, speed, store_id: selectedStore || null, play_mode: 'immediate', repeat_count: 1, duck_volume: duckVolume }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        audioUrl = data.audio_url;
        setCachedAudio(fullText, voice, speed, audioUrl);
      }
      const sKey   = sessionCacheKey(fullText, voice, speed, annVolume);
      const playUrl = sessionAudioCache.get(sKey) ?? await applyGainAndCache(audioUrl, annVolume / 100, sKey);
      if (player.track) {
        player.playAnnouncement(playUrl, { duck_volume: duckVolume, play_mode: 'immediate', repeat_count: callRepeat });
      } else {
        playAudioNTimes(playUrl, `call_${num}`, callRepeat);
      }
    } catch (e: any) {
      alert(`호출 실패: ${e.message}`);
    } finally {
      setCallingNum(null);
    }
  };

  // 성우 라벨 조회
  const voiceLabel = (vt: string) => {
    const found = fishVoices.find(fv => `fish_${fv.refId}` === vt);
    return found ? `${found.emoji} ${found.label}` : vt;
  };

  // TTS 생성 (캐시 우선)
  const handleGenerate = async () => {
    if (!text.trim()) { alert('안내 문구를 입력하세요'); return; }
    if (!voice || voice === 'fish_') { alert('성우를 선택하세요'); return; }
    const effectiveVoice = voice;
    setGenerating(true);
    // 인사말 + 본문 합치기
    const greetingPrefix = greetingOn && greeting.trim() ? `${greeting.trim()} ` : '';
    const fullText = `${greetingPrefix}${text.trim()}`;

    try {
      // 1. 원본 URL 확보 (localStorage 캐시 or API 생성)
      let audioUrl: string;
      const cached = getCachedAudio(fullText, effectiveVoice, speed);
      if (cached) {
        audioUrl = cached;
      } else {
        const res = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, voice_type: effectiveVoice, speed, store_id: null, play_mode: playMode, repeat_count: repeat, duck_volume: duckVolume }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        audioUrl = data.audio_url;
        setCachedAudio(fullText, effectiveVoice, speed, audioUrl);
        setCacheHit(true);
      }

      // 2. 볼륨 처리된 Blob URL 확보 (세션 메모리 캐시)
      const sKey = sessionCacheKey(fullText, effectiveVoice, speed, annVolume);
      let playUrl = sessionAudioCache.get(sKey);
      if (!playUrl) {
        playUrl = await applyGainAndCache(audioUrl, annVolume / 100, sKey);
      }

      // 3. DB 히스토리 저장
      const saveRes = await fetch('/api/tts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText, audio_url: audioUrl, voice_type: effectiveVoice, play_mode: playMode, repeat_count: repeat, duck_volume: duckVolume, store_id: selectedStore || null }),
      });
      const saveData = await saveRes.json();
      if (saveData.error) throw new Error(`히스토리 저장 실패: ${saveData.error}`);
      if (saveData.announcement) {
        setAnnouncements(prev => [saveData.announcement as Announcement, ...prev]);
      }

      // 4. 재생 (볼륨 처리된 URL로)
      if (player.track) {
        player.playAnnouncement(playUrl, { duck_volume: duckVolume, play_mode: playMode });
      } else {
        playAudio(playUrl, '__new__');
      }
    } catch (e: any) {
      alert(`실패: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // 히스토리 항목: 볼륨 처리 후 재생
  const playWithVolume = async (originalUrl: string, id: string, duckVol: number, playMode: 'immediate' | 'between_tracks') => {
    // 이미 같은 항목 재생 중이면 정지
    if (announcingId === id) {
      setAnnouncingId(null);
      return;
    }
    const sKey = `__hist__${originalUrl}__${annVolume}`;
    let playUrl = sessionAudioCache.get(sKey);
    if (!playUrl) {
      try { playUrl = await applyGainAndCache(originalUrl, annVolume / 100, sKey); }
      catch { playUrl = originalUrl; }
    }
    if (player.track) {
      setAnnouncingId(id);
      player.playAnnouncement(playUrl, { duck_volume: duckVol, play_mode: playMode });
    } else {
      setAnnouncingId(id);
      playAudio(playUrl, id);
    }
  };

  // announcementPlaying 종료 시 announcingId 초기화
  useEffect(() => {
    if (!player.announcementPlaying) setAnnouncingId(null);
  }, [player.announcementPlaying]);

  // 재생/정지
  const playAudio = (url: string, id: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === id) { setPlayingId(null); return; }
    const a = new Audio(url);
    audioRef.current = a;
    a.play().catch(() => alert('재생 실패'));
    setPlayingId(id);
    a.onended = () => { audioRef.current = null; setPlayingId(null); };
  };

  // N회 반복 재생 (고객 호출용)
  const playAudioNTimes = (url: string, id: string, times: number) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    let remaining = times;
    const playOnce = () => {
      const a = new Audio(url);
      audioRef.current = a;
      a.play().catch(() => alert('재생 실패'));
      setPlayingId(id);
      a.onended = () => {
        remaining--;
        if (remaining > 0) { playOnce(); }
        else { audioRef.current = null; setPlayingId(null); }
      };
    };
    playOnce();
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('안내방송을 삭제할까요?')) return;
    setDeleting(id);
    await sb.from('store_announcements').delete().eq('id', id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
  };

  const storeName = (id: string) => stores.find(s => s.id === id)?.name ?? id;

  return (
    <>
    <div className="min-h-screen bg-[#0D0F14] text-white flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone size={20} className="text-[#FF6F0F]" />
          <div>
            <h1 className="text-lg font-bold">AI 음성안내</h1>
            <p className="text-xs text-gray-500">매장 안내방송 생성 및 관리</p>
          </div>
        </div>
        {/* 가게 선택 */}
        <div className="relative">
          <select
            value={selectedStore}
            onChange={e => setSelectedStore(e.target.value)}
            className="appearance-none bg-[#1A1D23] border border-white/10 text-sm text-white rounded-xl px-4 py-2 pr-8 outline-none cursor-pointer"
          >
            <option value="">전체 가게</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* ── 생성 패널 ── */}
        <div className="w-[380px] shrink-0 border-r border-white/5 p-5 overflow-y-auto space-y-5">

          {/* 템플릿 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold flex items-center gap-1.5">
                <BookMarked size={11} /> 템플릿
              </label>
              <button onClick={() => openTplModal(null)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-[#FF6F0F]/10 border border-[#FF6F0F]/20 text-[#FF6F0F] hover:bg-[#FF6F0F]/20 transition">
                <Plus size={9} /> 추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl, i) => {
                const key = `${i}`;
                const isActive = selectedTplId === key;
                const hasSchedule = tpl.sched_time !== '';
                return (
                  <div key={key} className="relative group">
                    <button
                      onClick={() => handleSelectTemplate(tpl, key)}
                      className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition min-w-[56px] ${
                        isActive
                          ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      }`}>
                      <span className="text-xl leading-none">{tpl.emoji}</span>
                      <span className={`text-[9px] font-bold mt-0.5 text-center leading-tight ${isActive ? 'text-[#FF6F0F]' : 'text-gray-400'}`}>
                        {tpl.label}
                      </span>
                      {hasSchedule && <span className="text-[8px]">⏰</span>}
                    </button>
                    {/* 편집 버튼 (hover) */}
                    <button
                      onClick={e => { e.stopPropagation(); openTplModal(tpl, i); }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1A1D23] border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Pencil size={7} className="text-gray-400" />
                    </button>
                  </div>
                );
              })}
            </div>
            {/* 선택된 템플릿 저장 힌트 */}
            {selectedTplId !== null && (
              <div className="flex items-center gap-2">
                <button onClick={handleSaveToTemplate}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition">
                  <BookMarked size={9} /> 📌 현재 설정을 템플릿에 저장
                </button>
                <button onClick={() => setSelectedTplId(null)} className="text-[10px] text-gray-600 hover:text-gray-400">
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          {/* 고객 호출 */}
          <div className="border border-white/8 rounded-2xl overflow-hidden">
            <button
              onClick={() => setCallOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Radio size={13} className="text-[#FF6F0F]" /> 고객 호출
              </span>
              <ChevronDown size={13} className={`text-gray-500 transition-transform ${callOpen ? 'rotate-180' : ''}`} />
            </button>

            {callOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                {/* 호출 문구 템플릿 */}
                <div className="pt-3 space-y-1">
                  <label className="text-[10px] text-gray-500 font-semibold">호출 문구 ({'{num}'}은 번호로 대체)</label>
                  <input
                    value={callTemplate}
                    onChange={e => {
                      setCallTemplate(e.target.value);
                      try { localStorage.setItem(CALL_TEMPLATE_KEY, e.target.value); } catch {}
                    }}
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40"
                  />
                  <p className="text-[10px] text-gray-600">
                    미리보기: <span className="text-gray-400">"{(greetingOn && greeting.trim() ? greeting.trim() + ' ' : '') + callTemplate.replace('{num}', '101')}"</span>
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] text-gray-500 font-semibold">반복</span>
                    {[1, 2].map(n => (
                      <button
                        key={n}
                        onClick={() => setCallRepeat(n)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                          callRepeat === n
                            ? 'bg-[#FF6F0F] text-white'
                            : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'
                        }`}>
                        {n}회
                      </button>
                    ))}
                  </div>
                </div>

                {/* 즉시 호출 입력 */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-semibold">⚡ 즉시 호출 (번호 입력 후 Enter)</label>
                  <div className="flex gap-2">
                    <input
                      ref={directCallRef}
                      type="number"
                      value={directCallNum}
                      onChange={e => setDirectCallNum(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = parseInt(directCallNum);
                          if (!isNaN(n) && n > 0) { handleCallNum(n); setDirectCallNum(''); }
                        }
                      }}
                      placeholder="번호 입력"
                      className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40 [appearance:textfield]"
                    />
                    <button
                      onClick={() => {
                        const n = parseInt(directCallNum);
                        if (!isNaN(n) && n > 0) { handleCallNum(n); setDirectCallNum(''); directCallRef.current?.focus(); }
                      }}
                      disabled={callingNum !== null || !directCallNum}
                      className="px-4 py-2 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl disabled:opacity-40 transition hover:bg-[#FF6F0F]/90">
                      {callingNum !== null ? <Loader2 size={14} className="animate-spin" /> : '호출'}
                    </button>
                  </div>
                </div>

                {/* 번호 카드 그리드 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 font-semibold">시작 번호</label>
                    <input
                      type="number"
                      value={callStartNum}
                      onChange={e => setCallStartNum(e.target.value)}
                      placeholder="예) 100"
                      className="w-24 px-2 py-1 bg-white/[0.03] border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 outline-none focus:border-[#FF6F0F]/40 [appearance:textfield]"
                    />
                    {callStartNum && <span className="text-[10px] text-gray-600">{callStartNum} ~ {Number(callStartNum) + CALL_CARD_COUNT - 1}</span>}
                  </div>
                  {callStartNum && !isNaN(Number(callStartNum)) && (
                    <div className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: CALL_CARD_COUNT }, (_, i) => Number(callStartNum) + i).map(n => {
                        const isCalling = callingNum === n;
                        const isCached  = !!getCachedAudio(
                          `${greetingOn && greeting.trim() ? greeting.trim() + ' ' : ''}${callTemplate.replace('{num}', String(n))}`,
                          voice, speed
                        );
                        return (
                          <button
                            key={n}
                            onClick={() => handleCallNum(n)}
                            disabled={callingNum !== null}
                            className={`relative flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs font-bold transition ${
                              isCalling
                                ? 'bg-[#FF6F0F]/20 border-[#FF6F0F]/60 text-[#FF6F0F]'
                                : isCached
                                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-300 hover:bg-teal-500/20'
                                  : 'bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/[0.06] hover:border-white/20'
                            } disabled:cursor-not-allowed`}>
                            {isCalling
                              ? <Loader2 size={12} className="animate-spin" />
                              : <span>{n}</span>
                            }
                            {isCached && !isCalling && (
                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-teal-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!callStartNum && (
                    <p className="text-[10px] text-gray-600 text-center py-3">시작 번호를 입력하면 번호 카드가 나타납니다</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 인사말 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold">👋 인사말</label>
              <button onClick={() => setGreetingOn(v => !v)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition ${
                  greetingOn ? 'bg-[#FF6F0F]/20 text-[#FF6F0F]' : 'bg-white/5 text-gray-500'
                }`}>
                {greetingOn ? 'ON' : 'OFF'}
              </button>
            </div>
            <input
              value={greeting}
              onChange={e => {
                setGreeting(e.target.value);
                try { localStorage.setItem(GREETING_KEY, e.target.value); } catch {}
              }}
              placeholder="예) 안녕하세요, 고객 여러분."
              className={`w-full px-3 py-2 border rounded-xl text-sm text-white placeholder-gray-600 outline-none transition ${
                greetingOn
                  ? 'bg-[#FF6F0F]/5 border-[#FF6F0F]/20 focus:border-[#FF6F0F]/40'
                  : 'bg-white/[0.02] border-white/5 opacity-40'
              }`}
              disabled={!greetingOn}
            />
            {greetingOn && greeting.trim() && (
              <p className="text-[10px] text-gray-600 px-1">
                미리보기: <span className="text-gray-400">"{greeting.trim()} (안내 문구...)"</span>
              </p>
            )}
          </div>

          {/* 안내 문구 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold">🎙 안내 문구 *</label>
              <div className="flex items-center gap-2">
                {cacheHit && (
                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                    <DatabaseZap size={9} /> 캐시
                  </span>
                )}
                <span className={`text-[10px] ${text.length > 180 ? 'text-red-400' : 'text-gray-600'}`}>{text.length}/200</span>
              </div>
            </div>
            <textarea
              value={text}
              onChange={e => { const v = e.target.value.slice(0, 200); setText(v); checkCache(v, voice, speed); }}
              rows={3}
              placeholder="안내 문구를 입력하세요"
              className="w-full bg-[#1A1D23] border border-white/10 text-sm text-white rounded-xl px-3 py-2.5 outline-none placeholder-gray-600 resize-none"
            />
          </div>

          {/* 성우 카드 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold">🔊 성우</label>
              <span className="text-[10px] text-gray-600">Fish Audio · s2-pro · localStorage 저장</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {fishVoices.map(fv => {
                const vt         = `fish_${fv.refId}`;
                const isSelected = voice === vt;
                const isDefault  = defaultVoice === vt;
                const isEditing  = editingVoiceId === fv.id;
                const hasSample  = !!voiceSamples[vt];
                return (
                  <div key={fv.id} className={`relative flex flex-col rounded-xl border transition ${
                    isSelected ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50' : 'bg-teal-500/[0.05] border-teal-500/20'
                  }`}>
                    {/* 북마크 */}
                    <button onClick={() => {
                        const next = isDefault ? '' : vt;
                        setDefaultVoice(next);
                        try { localStorage.setItem(DEFAULT_VOICE_KEY, next); } catch {}
                      }}
                      title={isDefault ? '디폴트 해제' : '디폴트로 설정'}
                      className={`absolute top-1 right-1 transition ${isDefault ? 'text-[#FF6F0F]' : 'text-gray-700 hover:text-gray-400'}`}>
                      <Bookmark size={8} fill={isDefault ? '#FF6F0F' : 'none'} />
                    </button>
                    {/* 선택 */}
                    <button onClick={() => { setVoice(vt); checkCache(text, vt, speed); }}
                      className={`flex flex-col items-center gap-0.5 pt-2 pb-1 px-1 transition ${isSelected ? 'text-[#FF6F0F]' : 'text-gray-400 hover:text-white'}`}>
                      <span className="text-base">{fv.emoji}</span>
                      <span className="text-[9px] text-center leading-tight font-semibold truncate w-full px-0.5">{fv.label || '(이름없음)'}</span>
                    </button>
                    {/* 샘플 + 편집 + 삭제 */}
                    <div className="flex gap-0.5 mx-1 mb-1">
                      <button onClick={() => handleVoiceSample(vt)} disabled={samplingVoice === vt}
                        title={hasSample ? '캐시됨' : '샘플 생성'}
                        className={`flex-1 flex items-center justify-center py-1 rounded-lg text-[9px] font-semibold transition ${
                          playingVoice === vt ? 'bg-green-500/20 text-green-400'
                          : hasSample ? 'bg-teal-500/10 text-teal-400 hover:text-teal-300'
                          : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>
                        {samplingVoice === vt ? <Loader2 size={8} className="animate-spin" />
                          : playingVoice === vt ? <Pause size={8} />
                          : <Play size={8} />}
                      </button>
                      <button onClick={() => setEditingVoiceId(isEditing ? null : fv.id)}
                        className={`flex-1 flex items-center justify-center py-1 rounded-lg text-[9px] font-semibold transition ${
                          isEditing ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-gray-600 hover:text-gray-300'}`}>
                        <Pencil size={8} />
                      </button>
                      <button onClick={() => {
                          if (!confirm(`"${fv.label}" 성우를 삭제할까요?`)) return;
                          const updated = fishVoices.filter(f => f.id !== fv.id);
                          saveFishVoices(updated);
                          if (voice === vt) setVoice(updated[0] ? `fish_${updated[0].refId}` : '');
                        }}
                        className="flex-1 flex items-center justify-center py-1 rounded-lg text-[9px] font-semibold bg-white/5 text-gray-600 hover:text-red-400 transition">
                        <X size={8} />
                      </button>
                    </div>
                    {/* 인라인 편집 */}
                    {isEditing && (
                      <div className="px-1 pb-1.5 space-y-1">
                        <div className="flex gap-1">
                          {VOICE_EMOJIS.map(e => (
                            <button key={e} onClick={() => saveFishVoices(fishVoices.map(f => f.id === fv.id ? { ...f, emoji: e } : f))}
                              className={`text-xs rounded p-0.5 transition ${fv.emoji === e ? 'bg-teal-500/30' : 'hover:bg-white/10'}`}>{e}</button>
                          ))}
                        </div>
                        <input value={fv.label}
                          onChange={e => saveFishVoices(fishVoices.map(f => f.id === fv.id ? { ...f, label: e.target.value } : f))}
                          placeholder="이름"
                          className="w-full px-1.5 py-1 bg-black/30 border border-teal-500/30 rounded text-[10px] text-white placeholder-gray-600 outline-none" />
                        <input value={fv.refId}
                          onChange={e => saveFishVoices(fishVoices.map(f => f.id === fv.id ? { ...f, refId: e.target.value.trim() } : f))}
                          placeholder="Reference ID"
                          className="w-full px-1.5 py-1 bg-black/30 border border-teal-500/30 rounded text-[10px] text-white placeholder-gray-600 outline-none font-mono" />
                        <button onClick={() => setEditingVoiceId(null)}
                          className="w-full py-1 bg-teal-500/20 text-teal-400 rounded text-[10px] font-semibold hover:bg-teal-500/30 transition">
                          <Check size={10} className="inline mr-1" />완료
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 추가 버튼 */}
              {!addingVoice && (
                <button onClick={() => { setNewVoiceForm({ label: '', refId: '', emoji: '🎙️' }); setAddingVoice(true); }}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-teal-500/30 text-teal-600 hover:text-teal-400 hover:border-teal-400/50 transition py-3">
                  <Plus size={14} />
                  <span className="text-[9px] font-semibold">추가</span>
                </button>
              )}
            </div>

            {/* 새 성우 추가 폼 */}
            {addingVoice && (
              <div className="bg-teal-500/5 border border-teal-500/30 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {VOICE_EMOJIS.map(e => (
                    <button key={e} onClick={() => setNewVoiceForm(f => ({ ...f, emoji: e }))}
                      className={`text-sm rounded p-1 transition ${newVoiceForm.emoji === e ? 'bg-teal-500/30' : 'hover:bg-white/10'}`}>{e}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newVoiceForm.label} onChange={e => setNewVoiceForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="이름 (예: 한국어 여성)"
                    className="w-32 px-2 py-1.5 bg-black/30 border border-teal-500/30 rounded-lg text-xs text-white placeholder-gray-600 outline-none" />
                  <input value={newVoiceForm.refId} onChange={e => setNewVoiceForm(f => ({ ...f, refId: e.target.value.trim() }))}
                    placeholder="Fish Audio Reference ID"
                    className="flex-1 px-2 py-1.5 bg-black/30 border border-teal-500/30 rounded-lg text-xs text-white placeholder-gray-600 outline-none font-mono" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                      if (!newVoiceForm.label.trim() || !newVoiceForm.refId.trim()) { alert('이름과 Reference ID를 입력하세요'); return; }
                      const newCard: FishVoice = { id: `fv_${Date.now()}`, ...newVoiceForm };
                      saveFishVoices([...fishVoices, newCard]);
                      setAddingVoice(false);
                    }}
                    className="flex-1 py-1.5 bg-teal-500/20 text-teal-300 rounded-lg text-xs font-semibold hover:bg-teal-500/30 transition">
                    <Check size={11} className="inline mr-1" />저장
                  </button>
                  <button onClick={() => setAddingVoice(false)}
                    className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-semibold hover:text-white transition">취소</button>
                </div>
              </div>
            )}
          </div>

          {/* 속도 */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-semibold">⚡ 속도</label>
            <div className="flex gap-1.5">
              {SPEED_OPTIONS.map(s => (
                <button key={s} onClick={() => { setSpeed(s); checkCache(text, voice, s); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    speed === s
                      ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]'
                      : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                  }`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* 재생 모드 + 반복 횟수 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-semibold">📡 방송 방식</label>
              <div className="space-y-1">
                {PLAY_MODES.map(m => (
                  <button key={m.value} onClick={() => setPlayMode(m.value as any)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      playMode === m.value
                        ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]'
                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-semibold">🔁 반복</label>
              <div className="space-y-1">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setRepeat(n)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      repeat === n
                        ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]'
                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                    }`}>
                    {n}회
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 안내방송 볼륨 */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-semibold">📢 안내방송 볼륨</label>
              <span className={`text-xs font-bold ${annVolume > 100 ? 'text-yellow-400' : 'text-[#FF6F0F]'}`}>{annVolume}%</span>
            </div>
            <input type="range" min={50} max={200} step={5}
              value={annVolume} onChange={e => { const v = Number(e.target.value); setAnnVolume(v); checkCache(text, voice, speed, v); }}
              className="w-full h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: annVolume > 100 ? '#facc15' : '#FF6F0F' }}
            />
            <div className="flex justify-between text-[9px] text-gray-600">
              <span>50%</span>
              <span className="text-gray-500">100% (기본)</span>
              <span>200%</span>
            </div>
            {annVolume > 100 && (
              <p className="text-[10px] text-yellow-500/80">⚡ 부스트 모드 · WebAudio 증폭 적용</p>
            )}
          </div>

          {/* 즉시 방송 - 트랙 볼륨 덕킹 설정 */}
          {playMode === 'immediate' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500 font-semibold">🔉 안내방송 중 트랙 볼륨</label>
                <span className="text-xs font-bold text-[#FF6F0F]">{duckVolume}%</span>
              </div>
              <input type="range" min={0} max={80} step={5}
                value={duckVolume} onChange={e => setDuckVolume(Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer"
                style={{ accentColor: '#FF6F0F' }}
              />
              <p className="text-[10px] text-gray-600">
                안내방송 시작 시 트랙을 {duckVolume}%로 페이드 아웃 → 방송 종료 후 원래 볼륨으로 페이드 인
              </p>
            </div>
          )}
          {playMode === 'between_tracks' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
              <p className="text-[10px] text-gray-600">
                현재 곡이 완전히 끝난 후 안내방송 → 다음 곡 자동 재생
              </p>
            </div>
          )}

          {/* 생성 버튼 */}
          <button onClick={handleGenerate} disabled={generating || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> {cacheHit ? '재사용 중...' : '생성 중...'}</>
              : cacheHit
                ? <><DatabaseZap size={16} /> 캐시 재사용 · 방송하기</>
                : <><Volume2 size={16} /> 음성 생성하기</>
            }
          </button>

          <p className="text-[10px] text-gray-600 text-center">
            {cacheHit ? '동일 문구·목소리 → 캐시 재사용 (API 미호출)' : 'OpenAI TTS API 사용 · 생성 후 즉시 미리듣기'}
          </p>
        </div>

        {/* ── 목록 패널 ── */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400">
              {selectedStore ? stores.find(s => s.id === selectedStore)?.name : '전체'} 안내방송
              <span className="ml-2 text-gray-600">· {announcements.length}건</span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-600">
              <Loader2 size={20} className="animate-spin mr-2" /> 불러오는 중...
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600">
              <Megaphone size={32} className="mb-3 opacity-30" />
              <p className="text-sm">생성된 안내방송이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.map(ann => (
                <div key={ann.id}
                  className="bg-[#1A1D23] border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3 hover:border-white/10 transition">
                  {/* 재생 버튼 */}
                  <button
                    onClick={() => {
                      if (!ann.audio_url) return;
                      playWithVolume(ann.audio_url, ann.id, (ann as any).duck_volume ?? 20, ann.play_mode);
                    }}
                    disabled={!ann.audio_url}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition ${
                      playingId === ann.id || announcingId === ann.id
                        ? 'bg-[#FF6F0F] text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white disabled:opacity-30'
                    }`}>
                    {playingId === ann.id || announcingId === ann.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </button>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug">{ann.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {!selectedStore && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] border border-[#FF6F0F]/20">
                          {storeName(ann.store_id)}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-600">{voiceLabel(ann.voice_type)}</span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[10px] text-gray-600">{MODE_LABEL[ann.play_mode] ?? ann.play_mode}</span>
                      <span className="text-[10px] text-gray-600">· {ann.repeat_count}회</span>
                      <span className="text-[10px] text-gray-600 ml-auto">{fmtTime(ann.created_at)}</span>
                    </div>
                  </div>

                  {/* 즉시방송 (트랙 재생 중일 때 덕킹) */}
                  {ann.audio_url && player.track && (
                    <button
                      onClick={() => playWithVolume(ann.audio_url!, ann.id, (ann as any).duck_volume ?? 20, ann.play_mode)}
                      disabled={player.announcementPlaying}
                      title={ann.play_mode === 'immediate' ? '즉시 방송 (트랙 페이드 아웃)' : '곡간 삽입 대기'}
                      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                        announcingId === ann.id && player.announcementPlaying
                          ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/40 text-[#FF6F0F] cursor-not-allowed'
                          : player.announcementPlaying
                            ? 'bg-white/5 border-white/10 text-gray-600 cursor-not-allowed opacity-40'
                            : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                      }`}>
                      <Radio size={10} />
                      {ann.play_mode === 'immediate' ? '즉시' : '곡간'}
                    </button>
                  )}
                  {/* 삭제 */}
                  <button onClick={() => handleDelete(ann.id)} disabled={deleting === ann.id}
                    className="shrink-0 text-gray-600 hover:text-red-400 transition p-1">
                    {deleting === ann.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ── 템플릿 편집 모달 ── */}
      {tplModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1A1D23] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {tplEditTarget ? '템플릿 수정' : '새 템플릿 추가'}
              </h3>
              <button onClick={() => setTplModal(false)} className="text-gray-500 hover:text-white transition">
                <X size={16} />
              </button>
            </div>

            {/* 이모지 + 라벨 */}
            <div className="flex gap-2">
              <input value={tplEditEmoji} onChange={e => setTplEditEmoji(e.target.value)}
                maxLength={2}
                className="w-14 text-center bg-[#0D0F14] border border-white/10 text-xl rounded-xl py-2 outline-none"
                placeholder="📢" />
              <input value={tplEditLabel} onChange={e => setTplEditLabel(e.target.value)}
                placeholder="템플릿 이름"
                className="flex-1 bg-[#0D0F14] border border-white/10 text-sm text-white rounded-xl px-3 py-2 outline-none placeholder-gray-600" />
            </div>

            {/* 안내 문구 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">안내 문구 *</label>
              <textarea value={tplEditText} onChange={e => setTplEditText(e.target.value.slice(0, 200))}
                rows={3} placeholder="안내 문구를 입력하세요"
                className="w-full bg-[#0D0F14] border border-white/10 text-sm text-white rounded-xl px-3 py-2 outline-none placeholder-gray-600 resize-none" />
            </div>

            {/* 목소리 + 속도 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">목소리</label>
                <select value={tplEditVoice} onChange={e => setTplEditVoice(e.target.value)}
                  className="w-full bg-[#0D0F14] border border-white/10 text-xs text-white rounded-xl px-2 py-1.5 outline-none">
                  {VOICES.map(v => <option key={v.value} value={v.value}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">속도</label>
                <div className="flex gap-1">
                  {SPEED_OPTIONS.map(s => (
                    <button key={s} onClick={() => setTplEditSpeed(s)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-semibold border transition ${
                        tplEditSpeed === s
                          ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]'
                          : 'bg-white/[0.03] border-white/10 text-gray-400'
                      }`}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 방송방식 + 반복 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">방송 방식</label>
                <div className="flex flex-col gap-1">
                  {PLAY_MODES.map(m => (
                    <button key={m.value} onClick={() => setTplEditMode(m.value as any)}
                      className={`text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        tplEditMode === m.value
                          ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]'
                          : 'bg-white/[0.03] border-white/10 text-gray-400'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">반복 횟수</label>
                <div className="flex flex-col gap-1">
                  {[1,2,3].map(n => (
                    <button key={n} onClick={() => setTplEditRepeat(n)}
                      className={`text-left px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        tplEditRepeat === n
                          ? 'bg-[#FF6F0F]/15 border-[#FF6F0F]/50 text-[#FF6F0F]'
                          : 'bg-white/[0.03] border-white/10 text-gray-400'
                      }`}>
                      {n}회
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 예약 설정 */}
            <div className="bg-[#0D0F14] border border-white/5 rounded-xl p-3 space-y-2">
              <label className="text-xs text-gray-500 font-semibold">⏰ 예약 설정 (선택)</label>
              {/* 요일 */}
              <div className="flex gap-1.5 flex-wrap">
                {DAYS_KR.map((day, i) => (
                  <button key={i} onClick={() => toggleTplDay(i)}
                    className={`w-8 h-8 rounded-full text-[11px] font-bold border transition ${
                      tplEditDays.includes(i)
                        ? 'bg-[#FF6F0F]/20 border-[#FF6F0F]/50 text-[#FF6F0F]'
                        : 'bg-white/5 border-white/10 text-gray-500'
                    }`}>
                    {day}
                  </button>
                ))}
                {tplEditDays.length > 0 && (
                  <button onClick={() => setTplEditDays([])}
                    className="text-[10px] text-gray-600 hover:text-gray-400 px-1">초기화</button>
                )}
              </div>
              {/* 시간 */}
              <input type="time" value={tplEditTime} onChange={e => setTplEditTime(e.target.value)}
                className="bg-[#1A1D23] border border-white/10 text-sm text-white rounded-lg px-3 py-1.5 outline-none"
                style={{ colorScheme: 'dark' }} />
              <p className="text-[10px] text-gray-600">
                {tplEditDays.length === 0 && tplEditTime === '' ? '예약 없음 (즉시 방송)' :
                 tplEditDays.length === 0 ? `매일 ${tplEditTime}` :
                 `${tplEditDays.map(d => DAYS_KR[d]).join('·')} ${tplEditTime || '매 시간'}`}
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pt-1">
              {tplEditTarget && (
                <button onClick={() => handleDeleteTemplate(tplEditTarget)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition">
                  <Trash2 size={12} /> 삭제
                </button>
              )}
              <button onClick={() => setTplModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold hover:bg-white/10 transition">
                취소
              </button>
              <button onClick={handleConfirmTplEdit}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#FF6F0F] text-white text-xs font-bold hover:bg-[#FF6F0F]/90 transition">
                <Check size={13} /> 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
