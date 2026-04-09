// ─── 공유 타입 / 상수 / 유틸리티 ───────────────────────────────
export interface Store { id: string; name: string; }

export interface Announcement {
  id:           string;
  store_id:     string;
  text:         string;
  audio_url:    string | null;
  voice_type:   string;
  play_mode:    'immediate' | 'between_tracks';
  repeat_count: number;
  is_active:    boolean;
  created_at:   string;
  ann_type?:    'call' | 'template';
  pinned?:      boolean;
}

export interface TtsTemplate {
  id?:          string;
  emoji:        string;
  label:        string;
  text:         string;
  voice_type:   string;
  speed:        number;
  play_mode:    'immediate' | 'between_tracks';
  repeat_count: number;
  duck_volume:  number;
  sched_days:   number[];
  sched_time:   string;
  store_id?:    string | null;
}

export interface FishVoice { id: string; label: string; refId: string; emoji: string; }

// ─── 상수 ──────────────────────────────────────────────────────
export const DAYS_KR = ['월', '화', '수', '목', '금', '토', '일'];
export const DEFAULT_FISH_VOICE = 'fish_18e99f7be5374fa9b5ae52ed2f51e80d';
export const DEFAULT_FISH_VOICES: FishVoice[] = [
  { id: 'default_ko_male', label: '한국어 남성', refId: '18e99f7be5374fa9b5ae52ed2f51e80d', emoji: '🐟' },
];

export const PLAY_MODES = [
  { value: 'immediate',      label: '즉시 방송' },
  { value: 'between_tracks', label: '곡간 삽입' },
];

export const SPEED_OPTIONS    = [0.75, 1.0, 1.25, 1.5];
export const VOICE_EMOJIS     = ['🐟','🐠','🐡','🦈','🐬','🦭','🎙️','🎤','👩','👨','🧑','🎭','🌸','🌿','⭐'];
export const CALL_CARD_COUNT  = 20;

export const TEMPLATES_LS_KEY  = 'tts_templates_admin';
export const HISTORY_LS_KEY    = 'ann_history';
export const AUDIO_CACHE_KEY   = 'tts_audio_cache';
export const DEFAULT_VOICE_KEY = 'tts_default_voice';
export const GREETING_KEY      = 'tts_greeting';
export const CALL_TEMPLATE_KEY = 'tts_call_template';
export const SAMPLE_CACHE_KEY  = 'tts_sample_cache';

export const DEFAULT_TEMPLATES: TtsTemplate[] = [
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

export const MODE_LABEL: Record<string, string> = Object.fromEntries(PLAY_MODES.map(m => [m.value, m.label]));

// ─── 유틸 함수 ─────────────────────────────────────────────────
export function numToKorean(n: number): string {
  if (n === 0) return '영';
  const units  = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const places = ['', '십', '백', '천'];
  const bigUnits = ['', '만', '억', '조'];
  let result = '';
  let bigIdx = 0;
  while (n > 0) {
    const chunk = n % 10000;
    if (chunk > 0) {
      let chunkStr = '';
      for (let i = 3; i >= 0; i--) {
        const d = Math.floor(chunk / Math.pow(10, i)) % 10;
        if (d === 0) continue;
        chunkStr += (d === 1 && i > 0 ? '' : units[d]) + places[i];
      }
      result = chunkStr + bigUnits[bigIdx] + result;
    }
    n = Math.floor(n / 10000);
    bigIdx++;
  }
  return result;
}

/** 텍스트 내 모든 정수(쉼표 포함)를 한글 발음으로 치환 — TTS 전송용 */
export function replaceNumbersWithKorean(text: string): string {
  // 쉼표 포함 숫자(1,000 등)부터 단순 정수까지 모두 치환
  return text.replace(/\d[\d,]*/g, (match) => {
    const n = parseInt(match.replace(/,/g, ''), 10);
    return isNaN(n) ? match : numToKorean(n);
  });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── 오디오 캐시 ────────────────────────────────────────────────
export const sessionAudioCache = new Map<string, string>();

export function sessionCacheKey(text: string, voice: string, speed: number) {
  return `${text.trim()}__${voice}__${speed}`;
}

export async function fetchBlobUrl(url: string, cacheKey: string): Promise<string> {
  const cached = sessionAudioCache.get(cacheKey);
  if (cached) return cached;
  const buf = await fetch(url).then(r => r.arrayBuffer());
  const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
  sessionAudioCache.set(cacheKey, blobUrl);
  return blobUrl;
}

export function getCachedAudio(text: string, voice: string, speed: number): string | null {
  try {
    const cache = JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY) || '{}');
    return cache[`${text.trim()}__${voice}__${speed}`] ?? null;
  } catch { return null; }
}

export function setCachedAudio(text: string, voice: string, speed: number, url: string) {
  try {
    const cache = JSON.parse(localStorage.getItem(AUDIO_CACHE_KEY) || '{}');
    cache[`${text.trim()}__${voice}__${speed}`] = url;
    localStorage.setItem(AUDIO_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// ─── 히스토리 localStorage 헬퍼 ─────────────────────────────────
export function loadHistoryFromLS(): Announcement[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_LS_KEY) || '[]'); } catch { return []; }
}

export function pushHistoryToLS(ann: Announcement & { duck_volume?: number }) {
  try {
    const updated = [ann, ...loadHistoryFromLS()].slice(0, 100);
    localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(updated));
  } catch {}
}

export function removeHistoryFromLS(id: string) {
  try {
    localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(loadHistoryFromLS().filter(a => a.id !== id)));
  } catch {}
}

export function saveHistoryToLS(list: Announcement[]) {
  try { localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(list.slice(0, 100))); } catch {}
}

export function voiceLabel(fishVoices: FishVoice[], vt: string): string {
  const found = fishVoices.find(fv => `fish_${fv.refId}` === vt);
  return found ? `${found.emoji} ${found.label}` : vt;
}
