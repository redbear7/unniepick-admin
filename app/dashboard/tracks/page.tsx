'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Check, Play, Pause, Upload, ImagePlus, Link, Heart, ListMusic as ListMusicIcon, ArrowDownUp, Headphones, GripVertical, Copy, ClipboardCheck } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

// ─── 타입 ──────────────────────────────────────────────────────
interface MusicTrack {
  id:              string;
  title:           string;
  artist:          string;
  mood:            string;
  mood_tags:       string[];
  time_tags:       string[];
  bpm:             number | null;
  energy_level:    'low' | 'medium' | 'high' | null;
  store_category:  string;
  audio_url:       string;
  cover_image_url: string | null;
  duration_sec:    number;
  cover_emoji:     string;
  is_active:       boolean;
  created_at:      string;
  reference_url:   string | null;
  suno_url?:           string | null;
  play_count?:         number | null;
  like_count?:         number | null;
  energy_score?:       number | null;
  valence_score?:      number | null;
  danceability_score?: number | null;
  lyrics?:             string | null;
}

// ─── 태그 옵션 ─────────────────────────────────────────────────
const MOOD_OPTIONS     = ['lo-fi','jazz','acoustic','cozy','chill','upbeat','bright','pop','indie','ambient','lounge','r&b','tropical','morning-coffee','fresh','warm','night','energetic','EDM','k-pop','study'];
const TIME_OPTIONS     = ['morning','afternoon','evening','night','late_night'];
const CATEGORY_OPTIONS = ['all','cafe','food','beauty','health','mart','bar'];
const ENERGY_OPTIONS   = ['low','medium','high'] as const;

const TIME_KO:     Record<string, string> = { morning:'아침', afternoon:'오후', evening:'저녁', night:'밤', late_night:'심야' };
const CATEGORY_KO: Record<string, string> = { all:'전체', cafe:'카페', food:'음식점', beauty:'뷰티', health:'건강', mart:'마트', bar:'바' };
const ENERGY_KO:   Record<string, string> = { low:'낮음', medium:'보통', high:'높음' };

const EMOJI_OPTIONS = ['🎵','🎶','🎸','🎹','🎺','🎷','🥁','🎻','🎤','🎧','🎼','🌙','☀️','🌿','🔥','💫','🍃','🌊','🎊','💜'];

// ─── Suno 스타일 태그 라이브러리 ───────────────────────────────────
const SUNO_STYLE_TAGS: Record<string, Record<string, string[]>> = {
  '🎤 보컬 음색': {
    '성별·타입':  ['female vocals','male vocals','androgynous vocals','duet','choir','group vocals','no vocals'],
    '음역대':     ['soprano','mezzo-soprano','alto','tenor','baritone','bass vocals'],
    '음색 질감':  ['breathy','airy','silky smooth','warm','bright','clear','dark tone','raspy','husky','gravelly','smoky','gritty','nasal','throaty'],
    '창법·테크닉':['falsetto','head voice','chest voice','mixed voice','belting','vibrato','melisma','whisper','spoken word','vocal growl','yodel','scat'],
    '감성·스타일':['soulful','powerful','tender','intimate','dramatic','vulnerable','passionate','melancholic vocals','ethereal','angelic'],
    '처리·이펙트':['reverb vocals','echo vocals','auto-tune','harmonized vocals','layered vocals','distorted vocals','vocal chop','pitch-shifted'],
  },
  '🎵 분위기·기타': {
    '분위기': ['uplifting','melancholic','dreamy','energetic','romantic','dark','nostalgic','cinematic','peaceful','intense'],
    '악기':   ['piano','guitar','violin','synth','drums','strings','bass guitar','trumpet','saxophone'],
    '템포':   ['slow','mid-tempo','uptempo','80bpm','100bpm','120bpm','140bpm','160bpm'],
    '시대':   ['80s','90s','2000s','retro','lo-fi','vintage','modern'],
    '라이브': ['live performance concert','live audience','MTV unplugged Live Session'],
  },
};
// 빠른 검색용 평탄화 목록
const ALL_SUNO_TAGS: string[] = Object.values(SUNO_STYLE_TAGS)
  .flatMap(cat => Object.values(cat).flat());

const STORAGE_BUCKET = 'music-tracks'; // Supabase Storage 버킷명

// ─── 무드 기반 카드 색상 맵 ──────────────────────────────────────
const MOOD_COLORS: Record<string, [string, string]> = {
  // [primary, secondary] — 그라디언트 양 끝 색상
  'lo-fi':           ['#6366f1', '#8b5cf6'],
  'jazz':            ['#d97706', '#b45309'],
  'acoustic':        ['#78716c', '#a8a29e'],
  'cozy':            ['#f59e0b', '#d97706'],
  'chill':           ['#06b6d4', '#0891b2'],
  'upbeat':          ['#f43f5e', '#e11d48'],
  'bright':          ['#facc15', '#eab308'],
  'pop':             ['#ec4899', '#db2777'],
  'indie':           ['#8b5cf6', '#7c3aed'],
  'ambient':         ['#164e63', '#155e75'],
  'lounge':          ['#a16207', '#92400e'],
  'r&b':             ['#7c3aed', '#6d28d9'],
  'tropical':        ['#10b981', '#059669'],
  'morning-coffee':  ['#92400e', '#78350f'],
  'fresh':           ['#22d3ee', '#06b6d4'],
  'warm':            ['#ea580c', '#c2410c'],
  'night':           ['#1e1b4b', '#312e81'],
  'energetic':       ['#ef4444', '#dc2626'],
  'EDM':             ['#a855f7', '#9333ea'],
  'k-pop':           ['#f472b6', '#ec4899'],
  'study':           ['#475569', '#64748b'],
  'latin':           ['#dc2626', '#b91c1c'],
  'romantic':        ['#e11d48', '#be123c'],
  'hard rock':       ['#57534e', '#44403c'],
  'synth-pop':       ['#c084fc', '#a855f7'],
  'classical':       ['#854d0e', '#713f12'],
};
const DEFAULT_MOOD_COLOR: [string, string] = ['#334155', '#475569'];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ─── 가사 언어 감지 ──────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  '한국어': '#3b82f6', '영어': '#8b5cf6', '일본어': '#ec4899',
  '중국어': '#ef4444', '스페인어': '#f59e0b', '이탈리아어': '#10b981',
  '프랑스어': '#6366f1', '포르투갈어': '#14b8a6', '기타': '#6b7280',
};
const LANG_FLAGS: Record<string, string> = {
  '한국어': '🇰🇷', '영어': '🇺🇸', '일본어': '🇯🇵',
  '중국어': '🇨🇳', '스페인어': '🇪🇸', '이탈리아어': '🇮🇹',
  '프랑스어': '🇫🇷', '포르투갈어': '🇧🇷', '기타': '🌐',
};

function detectLang(text?: string | null): string {
  if (!text) return '';
  // [Language: xxx] 태그 확인
  const tag = text.match(/\[Language:\s*([^\]]+)\]/i);
  if (tag) return tag[1].trim();
  // 자동 감지
  const ko = (text.match(/[\uAC00-\uD7A3]/g) || []).length;
  const ja = (text.match(/[\u3040-\u30FF]/g) || []).length;
  const zh = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  const es = /\b(amor|coraz[oó]n|noche|baila|beso|cielo|luz|fuego)\b/i.test(text);
  const it = /\b(amore|cuore|notte|vita|dolce|sole|bello)\b/i.test(text);
  const fr = /\b(amour|nuit|coeur|belle|jour|rêve|ciel)\b/i.test(text);
  const pt = /\b(amor|coração|noite|saudade|céu|sol)\b/i.test(text);
  const en = (text.match(/[a-zA-Z]/g) || []).length;
  const max = Math.max(ko, ja, zh, en);
  if (max === 0) return '';
  if (max === ko) return '한국어';
  if (max === ja) return '일본어';
  if (zh > en * 0.3) return '중국어';
  if (es) return '스페인어';
  if (it) return '이탈리아어';
  if (fr) return '프랑스어';
  if (pt) return '포르투갈어';
  if (max === en) return '영어';
  return '기타';
}

function getTrackLang(track: MusicTrack): string {
  return detectLang(track.lyrics) || detectLang(track.title) || '';
}

function getMoodGradient(track: MusicTrack, isPlaying: boolean, bass = 0): string {
  const genre = (track.mood_tags ?? [])[0] || '';
  const [c1, c2] = MOOD_COLORS[genre] || DEFAULT_MOOD_COLOR;
  const energy = (track.energy_score ?? 50) / 100;
  const valence = (track.valence_score ?? 50) / 100;
  const angle = Math.round(135 + valence * 90);
  // 베이스에 반응: 재생 중일 때 bass 강도만큼 배경 밝아짐
  const bassBoost = isPlaying ? bass * 0.3 : 0;
  const a1 = (isPlaying ? 0.3 + energy * 0.2 : 0.1 + energy * 0.08) + bassBoost;
  const a2 = a1 * 0.4;
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return `linear-gradient(${angle}deg, rgba(${r1},${g1},${b1},${a1}), rgba(${r2},${g2},${b2},${a2}))`;
}

function getMoodGlow(track: MusicTrack, bass: number): string {
  const genre = (track.mood_tags ?? [])[0] || '';
  const [c1] = MOOD_COLORS[genre] || DEFAULT_MOOD_COLOR;
  const [r, g, b] = hexToRgb(c1);
  return `rgba(${r},${g},${b},${(bass * 0.5).toFixed(2)})`;
}

// Supabase Storage URL만 재생 허용 (외부 CDN URL은 만료됨)
const isPlayable = (url?: string | null): boolean =>
  !!url && url.includes('supabase.co/storage/');

const EMPTY_FORM = {
  title:           '',
  artist:          '',
  mood:            '',
  mood_tags:       [] as string[],
  time_tags:       [] as string[],
  bpm:             '' as string,
  energy_level:    '' as string,
  store_category:  'all',
  audio_url:       '',
  cover_image_url: '',
  duration_sec:    '' as string,
  cover_emoji:        '🎵',
  is_active:          true,
  reference_url:      '',
  suno_url:           '',
  energy_score:       '' as string,
  valence_score:      '' as string,
  danceability_score: '' as string,
  lyrics:             '',
};

// ─── localStorage 키 ────────────────────────────────────────────
const LS_CUSTOM_TAGS  = 'suno_lib_custom_tags';   // { tag, addedAt }[]
const LS_HIDDEN_TAGS  = 'suno_lib_hidden_tags';   // string[]
const NEW_TAG_DAYS    = 7;                         // 며칠 이내를 NEW로 표시

interface LibTag { tag: string; addedAt: number; }

// ─── 태그 칩 ───────────────────────────────────────────────────
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
        active
          ? 'bg-[#FF6F0F]/20 border border-[#FF6F0F] text-[#FF6F0F]'
          : 'bg-fill-subtle border border-border-subtle text-tertiary hover:text-primary hover:border-border-main'
      }`}>
      {label}
    </button>
  );
}

// ─── 삭제 가능한 라이브러리 칩 ──────────────────────────────────
function LibChip({ label, active, isNew, onClick, onDelete }: {
  label: string; active: boolean; isNew?: boolean;
  onClick: () => void; onDelete: () => void;
}) {
  return (
    <div className="relative group/lc inline-flex">
      <button onClick={onClick}
        className={`pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold transition ${
          active
            ? 'bg-[#FF6F0F]/20 border border-[#FF6F0F] text-[#FF6F0F]'
            : 'bg-fill-subtle border border-border-subtle text-tertiary hover:text-primary hover:border-border-main'
        }`}>
        {label}
        {isNew && (
          <span className="ml-1.5 text-[8px] font-bold bg-green-500 text-primary rounded px-1 py-0.5 align-middle">NEW</span>
        )}
      </button>
      {/* X 버튼: 호버 시 표시 */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="라이브러리에서 삭제"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center rounded-full text-dim hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/lc:opacity-100 transition">
        <X size={8} />
      </button>
    </div>
  );
}

// ─── 이미지를 1:1 정사각형으로 크롭 (canvas) ──────────────────
// 원본 비율 유지하며 최대 너비로 리사이징 (DB 저장용)
function resizeImageToMaxWidth(file: File, maxWidth = 800): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      // 너비가 maxWidth보다 크면 비율 유지하며 축소
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas context error')); return; }
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('blob 변환 실패'));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

// 1:1 정사각형으로 크롭 (카드 썸네일용 - 필요시)
function cropToSquare(file: File, targetSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width  = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas context error')); return; }
      const sx = (img.width  - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('blob 변환 실패'));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TracksPage() {
  const sb       = createClient();
  const player   = usePlayer();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── 현재 재생 트랙 캐시 상태 ──
  const [cacheInfo, setCacheInfo] = useState<{ cached: boolean; key: string } | null>(null);
  const [cacheStats, setCacheStats] = useState<{ count: number; sizeBytes: number } | null>(null);
  const [showCachePanel, setShowCachePanel] = useState(false);

  const openIDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((res, rej) => {
      const req = indexedDB.open('unniepick-audio-cache', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'url' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }, []);

  const checkCache = useCallback(async (audioUrl: string) => {
    try {
      const db = await openIDB();
      const tx = db.transaction('tracks', 'readonly');
      const result = await new Promise<unknown>((res, rej) => { const r = tx.objectStore('tracks').get(audioUrl); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      db.close();
      setCacheInfo({ cached: !!result, key: audioUrl });
    } catch { setCacheInfo(null); }
  }, [openIDB]);

  const loadCacheStats = useCallback(async () => {
    try {
      const db = await openIDB();
      const tx = db.transaction('tracks', 'readonly');
      const store = tx.objectStore('tracks');
      const all: { url: string; encrypted: ArrayBuffer }[] = await new Promise((res, rej) => {
        const r = store.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      db.close();
      const sizeBytes = all.reduce((sum, e) => sum + (e.encrypted?.byteLength || 0), 0);
      setCacheStats({ count: all.length, sizeBytes });
    } catch { setCacheStats({ count: 0, sizeBytes: 0 }); }
  }, [openIDB]);

  const clearCache = useCallback(async () => {
    try {
      const db = await openIDB();
      const tx = db.transaction('tracks', 'readwrite');
      tx.objectStore('tracks').clear();
      await new Promise<void>((res) => { tx.oncomplete = () => res(); });
      db.close();
      setCacheStats({ count: 0, sizeBytes: 0 });
      setCacheInfo(prev => prev ? { ...prev, cached: false } : null);
    } catch {}
  }, [openIDB]);

  useEffect(() => {
    if (player.track?.audio_url) checkCache(player.track.audio_url);
    else setCacheInfo(null);
  }, [player.track?.audio_url, checkCache]);

  useEffect(() => { if (showCachePanel) loadCacheStats(); }, [showCachePanel, loadCacheStats]);

  const [tracks,         setTracks]         = useState<MusicTrack[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [query,          setQuery]          = useState('');
  const [catFilter,      setCatFilter]      = useState('all');
  const [tagFilter,      setTagFilter]      = useState('');
  const [langFilter,     setLangFilter]     = useState('');
  const [toggling,       setToggling]       = useState<string | null>(null);
  const [deleting,       setDeleting]       = useState<string | null>(null);
  const [coverUploadId,  setCoverUploadId]  = useState<string | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [playlistCounts, setPlaylistCounts] = useState<Record<string, number>>({});
  const [sortOrder,      setSortOrder]      = useState<'latest' | 'plays' | 'likes' | 'playlists' | 'manual'>('latest');
  const [manualOrder,    setManualOrder]    = useState<string[]>([]);
  const dragTrackId       = useRef<string | null>(null);
  const [dragOverTrack, setDragOverTrack]  = useState<string | null>(null);

  // ── 재생수 카운팅 ─────────────────────────────────────────────
  const playCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countedTrackRef   = useRef<string | null>(null); // 이미 +1 카운팅한 트랙 ID

  // 모달
  const [modal,  setModal]  = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState(EMPTY_FORM);

  // Suno 태그 라이브러리 (localStorage 기반)
  const [customLibTags, setCustomLibTags] = useState<LibTag[]>([]);
  const [hiddenTags,    setHiddenTags]    = useState<Set<string>>(new Set());
  const [sunoTagsOpen,  setSunoTagsOpen]  = useState(false);

  // Suno 프롬프트 복사 피드백
  const [copied,      setCopied]      = useState(false);
  const [analyzing,   setAnalyzing]   = useState(false);

  // 업로드 상태
  const [audioUploading, setAudioUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [audioFileName,  setAudioFileName]  = useState('');
  const [testPlaying,    setTestPlaying]    = useState(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    load();
    // 커스텀 태그 라이브러리 로드
    try {
      const ct: LibTag[] = JSON.parse(localStorage.getItem(LS_CUSTOM_TAGS) || '[]');
      const ht: string[] = JSON.parse(localStorage.getItem(LS_HIDDEN_TAGS) || '[]');
      setCustomLibTags(ct);
      setHiddenTags(new Set(ht));
    } catch {}
    // 수동 순서 로드
    try {
      const mo: string[] = JSON.parse(localStorage.getItem('dashboard_tracks_manual_order') || '[]');
      setManualOrder(mo);
    } catch {}
  }, []);

  // ── 10초 재생 시 play_count +1 ──────────────────────────────
  useEffect(() => {
    const trackId = player.track?.id;

    // 이전 타이머 초기화
    if (playCountTimerRef.current) {
      clearTimeout(playCountTimerRef.current);
      playCountTimerRef.current = null;
    }

    // 재생 중이 아니거나 이미 카운팅된 트랙이면 종료
    if (!trackId || !player.isPlaying) return;
    if (countedTrackRef.current === trackId) return;

    playCountTimerRef.current = setTimeout(async () => {
      if (countedTrackRef.current === trackId) return;
      countedTrackRef.current = trackId;

      // DB에서 현재 count 조회 후 +1
      const { data } = await sb.from('music_tracks')
        .select('play_count').eq('id', trackId).single();
      const newCount = (data?.play_count ?? 0) + 1;
      await sb.from('music_tracks')
        .update({ play_count: newCount }).eq('id', trackId);

      // 로컬 상태 즉시 반영
      setTracks(prev => prev.map(t =>
        t.id === trackId ? { ...t, play_count: newCount } : t,
      ));
    }, 10000);

    return () => {
      if (playCountTimerRef.current) {
        clearTimeout(playCountTimerRef.current);
        playCountTimerRef.current = null;
      }
    };
  }, [player.track?.id, player.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    const [tracksRes, plRes] = await Promise.all([
      sb.from('music_tracks').select('*').order('created_at', { ascending: false }),
      sb.from('playlist_tracks').select('track_id'),
    ]);
    const trackList = (tracksRes.data ?? []) as MusicTrack[];
    setTracks(trackList);
    // playlist_tracks 집계
    const counts: Record<string, number> = {};
    (plRes.data ?? []).forEach((row: { track_id: string }) => {
      counts[row.track_id] = (counts[row.track_id] ?? 0) + 1;
    });
    setPlaylistCounts(counts);
    setLoading(false);
  };

  // ── 라이브러리 태그 추가 (신규 태그 자동 등록) ──────────────────
  const addTagsToLibrary = (tags: string[]) => {
    const unknown = tags.filter(
      t => !MOOD_OPTIONS.includes(t) && !ALL_SUNO_TAGS.includes(t)
    );
    if (!unknown.length) return;
    setCustomLibTags(prev => {
      const existSet = new Set(prev.map(e => e.tag));
      const toAdd: LibTag[] = unknown
        .filter(t => !existSet.has(t))
        .map(t => ({ tag: t, addedAt: Date.now() }));
      if (!toAdd.length) return prev;
      const updated = [...prev, ...toAdd];
      localStorage.setItem(LS_CUSTOM_TAGS, JSON.stringify(updated));
      return updated;
    });
  };

  // ── 라이브러리 태그 삭제 ─────────────────────────────────────────
  const deleteLibTag = (tag: string, isBuiltin: boolean) => {
    if (isBuiltin) {
      // 내장 태그: hidden 목록에 추가
      setHiddenTags(prev => {
        const next = new Set(prev);
        next.add(tag);
        localStorage.setItem(LS_HIDDEN_TAGS, JSON.stringify([...next]));
        return next;
      });
    } else {
      // 커스텀 태그: 목록에서 제거
      setCustomLibTags(prev => {
        const updated = prev.filter(e => e.tag !== tag);
        localStorage.setItem(LS_CUSTOM_TAGS, JSON.stringify(updated));
        return updated;
      });
    }
    // mood_tags에서도 제거
    setForm((f: typeof EMPTY_FORM) => ({
      ...f,
      mood_tags: f.mood_tags.filter((t: string) => t !== tag),
    }));
  };

  // ── 태그 집계 (mood_tags[0] = 메인 장르만 필터 태그로 사용) ──
  const tagCounts = tracks.reduce<Record<string, number>>((acc, t) => {
    const genre = (t.mood_tags ?? [])[0];
    if (genre) acc[genre] = (acc[genre] || 0) + 1;
    return acc;
  }, {});
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  // ── 언어 집계 ──
  const langCounts = tracks.reduce<Record<string, number>>((acc, t) => {
    const lang = getTrackLang(t);
    if (lang) acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {});
  const sortedLangs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);

  // ── 필터 + 정렬 ──
  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = tracks.filter(t => {
    const q = query.toLowerCase();
    const matchQ = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.mood.toLowerCase().includes(q);
    const matchC = catFilter === 'all' || t.store_category === catFilter || t.store_category === 'all';
    const matchT = !tagFilter || (t.mood_tags ?? [])[0] === tagFilter;
    const matchL = !langFilter || getTrackLang(t) === langFilter;
    return matchQ && matchC && matchT && matchL;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'plays')     return (b.play_count ?? 0) - (a.play_count ?? 0);
    if (sortOrder === 'likes')     return (b.like_count ?? 0) - (a.like_count ?? 0);
    if (sortOrder === 'playlists') return (playlistCounts[b.id] ?? 0) - (playlistCounts[a.id] ?? 0);
    // latest: today first, then by created_at desc
    const aToday = a.created_at.startsWith(todayStr) ? 1 : 0;
    const bToday = b.created_at.startsWith(todayStr) ? 1 : 0;
    if (bToday !== aToday) return bToday - aToday;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const todayTracks   = sorted.filter(t => t.created_at.startsWith(todayStr));
  const olderTracks   = sorted.filter(t => !t.created_at.startsWith(todayStr));

  // 수동 순서: filtered 기준으로 manualOrder 적용
  const manualSorted = sortOrder === 'manual' ? (() => {
    const idSet = new Set(filtered.map(t => t.id));
    const ordered = manualOrder.filter(id => idSet.has(id));
    const orderedSet = new Set(ordered);
    const rest = filtered.filter(t => !orderedSet.has(t.id));
    return [...ordered.map(id => filtered.find(t => t.id === id)!), ...rest];
  })() : [];

  // 화면에 표시되는 순서 기준 큐 (next/prev가 화면 순서를 따르도록)
  const displayList = sortOrder === 'manual' ? manualSorted : sorted;

  const saveManualOrder = (ids: string[]) => {
    setManualOrder(ids);
    localStorage.setItem('dashboard_tracks_manual_order', JSON.stringify(ids));
  };

  const handleTrackDragStart = (id: string) => { dragTrackId.current = id; };
  const handleTrackDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverTrack(id); };
  const handleTrackDrop      = (targetId: string) => {
    const fromId = dragTrackId.current;
    if (!fromId || fromId === targetId) { setDragOverTrack(null); return; }
    const ids = manualSorted.map(t => t.id);
    const fi = ids.indexOf(fromId);
    const ti = ids.indexOf(targetId);
    ids.splice(fi, 1);
    ids.splice(ti, 0, fromId);
    saveManualOrder(ids);
    dragTrackId.current = null;
    setDragOverTrack(null);
  };

  // ── 폼 헬퍼 ──
  const setF = (key: keyof typeof EMPTY_FORM, val: any) => setForm(f => ({ ...f, [key]: val }));
  const toggleArr = (key: 'mood_tags' | 'time_tags', tag: string) =>
    setF(key, form[key].includes(tag) ? form[key].filter((t: string) => t !== tag) : [...form[key], tag]);

  // 제목 입력 시 [핸들] 패턴 자동 파싱 → 레퍼런스 URL + 순수 제목 분리
  const handleTitleChange = (val: string) => {
    const match = val.match(/^\[(@?[^\]]+)\]\s*(.+)$/);
    if (match) {
      const raw = match[1].trim();
      const pureTitle = match[2].trim();
      const handle = raw.startsWith('@') ? raw : `@${raw}`;
      setForm(f => ({
        ...f,
        title: pureTitle,
        reference_url: `https://www.youtube.com/${handle}/`,
      }));
    } else {
      setF('title', val);
    }
  };

  // ── MP3 업로드 ──
  const uploadAudio = async (file: File) => {
    setAudioUploading(true);
    setAudioFileName(file.name);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `audio/${Date.now()}_${safeName}`;
      const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
        contentType: file.type || 'audio/mpeg',
        upsert: true,
      });
      if (error) throw error;
      const { data: { publicUrl } } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setF('audio_url', publicUrl);
    } catch (e: any) {
      alert(`오디오 업로드 실패: ${e.message}\n\nSupabase Storage에 '${STORAGE_BUCKET}' 버킷이 있는지 확인해주세요.`);
      setAudioFileName('');
    } finally {
      setAudioUploading(false);
    }
  };

  // ── 커버 이미지 업로드 (1:1 크롭) ──
  const uploadImage = async (file: File) => {
    setImageUploading(true);
    try {
      const blob = await cropToSquare(file);
      const path = `covers/${Date.now()}_cover.jpg`;
      const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;
      const { data: { publicUrl } } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setF('cover_image_url', publicUrl);
    } catch (e: any) {
      alert(`이미지 업로드 실패: ${e.message}`);
    } finally {
      setImageUploading(false);
    }
  };

  // ── 모달 열기 ──
  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setAudioFileName('');
    setSunoTagsOpen(false);
    setModal(true);
  };

  const openEdit = (t: MusicTrack) => {
    setEditId(t.id);
    setAudioFileName('');
    setSunoTagsOpen(false);
    // 신규 태그 자동 라이브러리 등록
    addTagsToLibrary(t.mood_tags ?? []);
    setForm({
      title:           t.title,
      artist:          t.artist,
      mood:            t.mood,
      mood_tags:       t.mood_tags ?? [],
      time_tags:       t.time_tags ?? [],
      bpm:             t.bpm != null ? String(t.bpm) : '',
      energy_level:    t.energy_level ?? '',
      store_category:  t.store_category,
      audio_url:       t.audio_url,
      cover_image_url: t.cover_image_url ?? '',
      duration_sec:    t.duration_sec != null ? String(t.duration_sec) : '',
      cover_emoji:        t.cover_emoji,
      is_active:          t.is_active,
      reference_url:      t.reference_url ?? '',
      suno_url:           t.suno_url ?? '',
      energy_score:       t.energy_score != null ? String(Math.round(t.energy_score * 100)) : '',
      valence_score:      t.valence_score != null ? String(Math.round(t.valence_score * 100)) : '',
      danceability_score: t.danceability_score != null ? String(Math.round(t.danceability_score * 100)) : '',
      lyrics:             t.lyrics ?? '',
    });
    setModal(true);
  };

  // ── AI 자동 분석 ──
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, mood_tags: form.mood_tags, lyrics: form.lyrics }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.energy_score       != null) setF('energy_score',       String(Math.round(data.energy_score)));
      if (data.valence_score      != null) setF('valence_score',      String(Math.round(data.valence_score)));
      if (data.danceability_score != null) setF('danceability_score', String(Math.round(data.danceability_score)));
      if (data.energy_level)  setF('energy_level', data.energy_level);
      if (data.time_tags?.length) setF('time_tags', data.time_tags);
    } catch (e: any) {
      alert(`AI 분석 실패: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── 저장 ──
  const handleSave = async () => {
    if (!form.title.trim())     { alert('제목을 입력해주세요'); return; }
    if (!form.artist.trim())    { alert('아티스트를 입력해주세요'); return; }
    if (!form.audio_url.trim()) { alert('오디오 파일을 업로드하거나 URL을 입력해주세요'); return; }
    if (!form.mood.trim())      { alert('무드를 입력해주세요'); return; }

    addTagsToLibrary(form.mood_tags);
    setSaving(true);
    try {
      const payload = {
        title:           form.title.trim(),
        artist:          form.artist.trim(),
        mood:            form.mood.trim(),
        mood_tags:       form.mood_tags,
        time_tags:       form.time_tags,
        bpm:             form.bpm ? Number(form.bpm) : null,
        energy_level:    (form.energy_level || null) as any,
        store_category:  form.store_category,
        audio_url:       form.audio_url.trim(),
        cover_image_url: form.cover_image_url.trim() || null,
        duration_sec:    form.duration_sec ? Number(form.duration_sec) : 0,
        cover_emoji:     form.cover_emoji,
        is_active:       form.is_active,
        reference_url:      form.reference_url.trim() || null,
        suno_url:           form.suno_url.trim() || null,
        energy_score:       form.energy_score !== '' ? Number(form.energy_score) / 100 : null,
        valence_score:      form.valence_score !== '' ? Number(form.valence_score) / 100 : null,
        danceability_score: form.danceability_score !== '' ? Number(form.danceability_score) / 100 : null,
        lyrics:             form.lyrics.trim() || null,
      };

      if (editId) {
        const { error } = await sb.from('music_tracks').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await sb.from('music_tracks').insert(payload);
        if (error) throw error;
      }

      await load();
      testAudioRef.current?.pause(); testAudioRef.current = null; setTestPlaying(false);
      setModal(false);
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── 활성화 토글 ──
  const handleToggle = async (t: MusicTrack) => {
    setToggling(t.id);
    await sb.from('music_tracks').update({ is_active: !t.is_active }).eq('id', t.id);
    setTracks(prev => prev.map(tr => tr.id === t.id ? { ...tr, is_active: !tr.is_active } : tr));
    setToggling(null);
  };

  // ── 삭제 ──
  const handlePasteCover = async (track: MusicTrack) => {
    setCoverUploadId(track.id);
    try {
      const items = await navigator.clipboard.read();
      let blob: Blob | null = null;
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          blob = await item.getType(imageType);
          break;
        }
      }
      if (!blob) {
        alert('클립보드에 이미지가 없습니다.');
        setCoverUploadId(null);
        return;
      }

      // 원본 비율 유지하며 최대 640px 너비로 리사이징 후 업로드
      const resizedBlob = await resizeImageToMaxWidth(new File([blob], 'cover.jpg', { type: blob.type }), 640);
      const path = `covers/${Date.now()}_cover.jpg`;
      const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, resizedBlob, {
        contentType: 'image/jpeg', upsert: true,
      });
      if (error) throw error;
      const { data: { publicUrl } } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      await sb.from('music_tracks').update({ cover_image_url: publicUrl }).eq('id', track.id);
      setTracks(prev => prev.map(tr => tr.id === track.id ? { ...tr, cover_image_url: publicUrl } : tr));
    } catch (e: any) {
      alert(`커버 변경 실패: ${e.message}`);
    } finally {
      setCoverUploadId(null);
    }
  };

  const handleDelete = async (t: MusicTrack) => {
    if (!confirm(`"${t.title}" 트랙을 삭제할까요?`)) return;
    setDeleting(t.id);
    await sb.from('music_tracks').delete().eq('id', t.id);
    setTracks(prev => prev.filter(tr => tr.id !== t.id));
    setDeleting(null);
  };

  // ── 재생 (하단 플레이어로 연결, Supabase Storage URL만 허용) ──
  const togglePlay = (track: MusicTrack) => {
    if (!isPlayable(track.audio_url)) return;
    const toPlayable = (t: MusicTrack) => ({
      id: t.id, title: t.title, artist: t.artist,
      audio_url: t.audio_url, cover_image_url: t.cover_image_url,
      cover_emoji: t.cover_emoji, duration_sec: t.duration_sec, mood: t.mood,
      mood_tags: t.mood_tags, energy_score: t.energy_score,
      valence_score: t.valence_score, danceability_score: t.danceability_score,
    });
    if (player.track?.id === track.id) {
      player.togglePlay();
    } else {
      const playableQueue = displayList.filter(t => isPlayable(t.audio_url)).map(toPlayable);
      player.play(toPlayable(track), playableQueue);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-main">
        <div>
          <h1 className="text-lg font-bold text-primary">🎵 트랙 관리</h1>
          <p className="text-xs text-muted mt-0.5">music_tracks 테이블 · 총 {tracks.length}개 · 서버파일 {tracks.filter(t => isPlayable(t.audio_url)).length}개</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] text-primary text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 transition">
          <Plus size={15} /> 새 트랙 등록
        </button>
      </div>

      {/* 커버 업로드 플로팅 배너 */}
      {coverUploadId && (
        <div className="fixed top-4 right-4 px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition z-50 bg-[#FF6F0F]/90 text-white">
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>📤 커버 업로드 중...</span>
        </div>
      )}

      {/* 현재 재생 트랙 캐시 정보 */}
      {player.track && cacheInfo && (
        <div className="border-b border-border-main bg-surface/50">
          <button
            onClick={() => setShowCachePanel(p => !p)}
            className="flex items-center gap-2 px-6 py-1.5 w-full hover:bg-fill-subtle/50 transition">
            <span className={`shrink-0 w-2 h-2 rounded-full ${cacheInfo.cached ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-[10px] text-muted truncate font-mono text-left flex-1">
              {cacheInfo.cached ? '⚡ 암호화 캐시' : '🌐 스트리밍'}{' · '}
              <span className="text-dim">IndexedDB › tracks › </span>
              <span className="text-tertiary">{cacheInfo.key.replace(/^https?:\/\/[^/]+/, '')}</span>
            </span>
            <span className="text-[10px] text-dim shrink-0">{showCachePanel ? '▲' : '▼'}</span>
          </button>

          {showCachePanel && cacheStats && (
            <div className="px-6 py-3 border-t border-border-subtle bg-card/50 flex items-center gap-4">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted">
                  🔐 암호화 캐시: <span className="text-primary font-semibold">{cacheStats.count}곡</span>
                </span>
                <span className="text-muted">
                  💾 용량: <span className="text-primary font-semibold">
                    {cacheStats.sizeBytes < 1024 * 1024
                      ? `${Math.round(cacheStats.sizeBytes / 1024)} KB`
                      : `${(cacheStats.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                  </span>
                </span>
                <span className="text-dim">AES-256-GCM · extractable=false</span>
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={loadCacheStats}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-fill-subtle text-tertiary hover:text-primary transition">
                  새로고침
                </button>
                <button onClick={() => { if (confirm('암호화 캐시를 모두 삭제합니다.')) clearCache(); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                  캐시 초기화
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 무드 태그 필터 */}
      {sortedTags.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border-main overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTagFilter('')}
            className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
              !tagFilter ? 'bg-[#FF6F0F] text-primary' : 'bg-fill-subtle text-tertiary hover:text-primary'
            }`}>
            전체 <span className="opacity-60">{tracks.length}</span>
          </button>
          {sortedTags.map(([tag, count]) => (
            <button key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                tagFilter === tag
                  ? 'bg-[#FF6F0F] text-primary'
                  : 'bg-fill-subtle text-tertiary hover:text-primary'
              }`}>
              {tag}
              <span className={`text-[10px] ${tagFilter === tag ? 'opacity-70' : 'opacity-50'}`}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* 언어 필터 */}
      {sortedLangs.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border-main overflow-x-auto scrollbar-none">
          <span className="text-[10px] text-dim shrink-0">🌐</span>
          <button onClick={() => setLangFilter('')}
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
              !langFilter ? 'bg-[#8b5cf6] text-white' : 'bg-fill-subtle text-tertiary hover:text-primary'
            }`}>
            전체
          </button>
          {sortedLangs.map(([lang, count]) => (
            <button key={lang}
              onClick={() => setLangFilter(langFilter === lang ? '' : lang)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition whitespace-nowrap ${
                langFilter === lang
                  ? 'text-white'
                  : 'bg-fill-subtle text-tertiary hover:text-primary'
              }`}
              style={langFilter === lang ? { backgroundColor: LANG_COLORS[lang] || '#6b7280' } : {}}>
              {LANG_FLAGS[lang] || '🌐'} {lang}
              <span className={`text-[10px] ${langFilter === lang ? 'opacity-70' : 'opacity-50'}`}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border-main flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="제목, 아티스트, 무드 검색..."
            className="w-full pl-8 pr-3 py-2 bg-card border border-border-subtle rounded-xl text-sm text-primary placeholder-gray-600 outline-none" />
        </div>
        {/* 정렬 */}
        <div className="flex gap-1 ml-auto">
          <ArrowDownUp size={13} className="text-dim self-center" />
          {([['latest','최신순'],['plays','재생순'],['likes','좋아요순'],['playlists','플리순'],['manual','수동']] as const).map(([v,label]) => (
            <button key={v} onClick={() => setSortOrder(v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                sortOrder === v ? 'bg-[#FF6F0F] text-primary' : 'bg-fill-subtle text-tertiary hover:text-primary'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-dim">{sorted.length}개</span>

        {/* 베이스 이펙트 조절 */}
        {player.isPlaying && (
          <div className="flex items-center gap-3 ml-1 pl-2 border-l border-border-subtle">
            <div className="flex items-center gap-1" title="주파수 대역">
              <span className="text-[10px] text-dim">🎚️</span>
              {['SUB','BASS','MID','HIGH','AIR'].map((label, i) => (
                <button key={i} onClick={() => player.setBassFreqBand(i)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                    player.bassFreqBand === i ? 'bg-[#FF6F0F] text-primary' : 'text-dim hover:text-tertiary'
                  }`}>{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1" title="펄스 속도">
              <span className="text-[10px] text-dim">⚡</span>
              <input type="range" min={0.3} max={3} step={0.1} value={player.bassSpeed}
                onChange={e => player.setBassSpeed(Number(e.target.value))}
                className="w-12 h-1 cursor-pointer" style={{ accentColor: '#FF6F0F' }} />
              <span className="text-[9px] text-dim w-6">{player.bassSpeed.toFixed(1)}x</span>
            </div>
          </div>
        )}
      </div>

      {/* 트랙 목록 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3">
            <div className="w-6 h-6 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
            <span className="text-muted text-sm">불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🎵</span>
            <p className="text-muted text-sm">트랙이 없어요</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* 수동 정렬 그리드 */}
            {sortOrder === 'manual' ? (
              <>
                <div className="flex items-center gap-2">
                  <GripVertical size={12} className="text-dim" />
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wide">드래그로 순서 변경 · {manualSorted.length}개</span>
                  <div className="flex-1 h-px bg-fill-subtle" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {manualSorted.map(track => (
                    <div
                      key={track.id}
                      draggable
                      onDragStart={() => handleTrackDragStart(track.id)}
                      onDragOver={e => handleTrackDragOver(e, track.id)}
                      onDrop={() => handleTrackDrop(track.id)}
                      onDragEnd={() => setDragOverTrack(null)}
                      className={`rounded-xl transition-all ${dragOverTrack === track.id ? 'ring-1 ring-[#FF6F0F]/50 scale-[1.02]' : ''}`}
                    >
                      {renderCard(track)}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* 오늘 등록 섹션 */}
                {sortOrder === 'latest' && todayTracks.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#FF6F0F] uppercase tracking-wide">오늘 등록 · {todayTracks.length}개</span>
                      <div className="flex-1 h-px bg-[#FF6F0F]/20" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {todayTracks.map(track => renderCard(track))}
                    </div>
                    {olderTracks.length > 0 && (
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wide">이전 트랙 · {olderTracks.length}개</span>
                        <div className="flex-1 h-px bg-fill-subtle" />
                      </div>
                    )}
                  </>
                )}
                {/* 이전 트랙 or 전체(비최신순) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {(sortOrder === 'latest' ? olderTracks : sorted).map(track => renderCard(track))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {/* ── 등록/편집 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#13161D] border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-main shrink-0">
              <h2 className="text-base font-bold text-primary">
                {editId ? '✏️ 트랙 수정' : '➕ 새 트랙 등록'}
              </h2>
              <button onClick={() => { testAudioRef.current?.pause(); testAudioRef.current = null; setTestPlaying(false); setModal(false); }} className="text-muted hover:text-primary transition">
                <X size={18} />
              </button>
            </div>

            {/* 폼 */}
            <div className="flex-1 overflow-auto px-6 py-5 space-y-5">

              {/* ── 커버 이미지 + 제목/아티스트/무드 ── */}
              <div className="flex gap-4 items-start">

                {/* 커버 이미지 업로드 */}
                <div className="shrink-0 space-y-2">
                  <label className="text-xs text-muted font-semibold block">커버 이미지</label>

                  {/* 원본 비율 유지 미리보기 */}
                  <div
                    onClick={() => form.cover_image_url ? setPreviewUrl(form.cover_image_url) : imageInputRef.current?.click()}
                    className="relative rounded-xl overflow-hidden bg-[#1F2937] border-2 border-dashed border-border-main flex items-center justify-center cursor-pointer hover:border-[#FF6F0F]/50 transition group w-28">
                    {form.cover_image_url ? (
                      <img src={form.cover_image_url} alt="cover" className="w-full h-auto object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 py-6">
                        <span className="text-3xl">{form.cover_emoji}</span>
                        <span className="text-[10px] text-dim group-hover:text-tertiary transition">클릭</span>
                      </div>
                    )}
                    {imageUploading && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
                      </div>
                    )}
                    {/* 비율 배지 */}
                    {form.cover_image_url && (
                      <div className="absolute top-1.5 right-1.5 bg-black/60 text-[9px] text-tertiary px-1.5 py-0.5 rounded-md font-mono">
                        원본
                      </div>
                    )}
                  </div>

                  {/* 숨겨진 파일 입력 */}
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; uploadImage(f); } }} />

                  <div className="flex gap-1">
                    <button onClick={() => imageInputRef.current?.click()} disabled={imageUploading}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded-lg hover:text-primary hover:border-border-main transition disabled:opacity-40">
                      <ImagePlus size={10} /> 사진 선택
                    </button>
                    {form.cover_image_url && (
                      <button onClick={() => setF('cover_image_url', '')}
                        className="px-2 py-1.5 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:text-red-300 transition">
                        <X size={10} />
                      </button>
                    )}
                  </div>

                  {/* 이모지 (이미지 없을 때 대체) */}
                  {!form.cover_image_url && (
                    <div>
                      <p className="text-[10px] text-dim mb-1">이모지 (이미지 없을 때)</p>
                      <div className="flex flex-wrap gap-1 w-28">
                        {EMOJI_OPTIONS.map(e => (
                          <button key={e} onClick={() => setF('cover_emoji', e)}
                            className={`w-6 h-6 rounded-md text-sm flex items-center justify-center transition ${
                              form.cover_emoji === e ? 'bg-[#FF6F0F]/20 border border-[#FF6F0F]' : 'bg-fill-subtle border border-border-subtle hover:border-border-main'
                            }`}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 제목/아티스트/무드/BPM/길이 */}
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-xs text-muted font-semibold block mb-1.5">제목 *</label>
                    <input value={form.title} onChange={e => handleTitleChange(e.target.value)}
                      placeholder="Morning Breeze  (또는 [@handle] Morning Breeze 형식으로 입력 시 레퍼런스 자동 분리)"
                      className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600" />
                    {/* 레퍼런스 URL — [핸들] 패턴에서 자동 추출 또는 직접 입력 */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        value={form.reference_url}
                        onChange={e => setF('reference_url', e.target.value)}
                        placeholder="https://www.youtube.com/@handle/"
                        className="flex-1 bg-[#1F2937] text-[11px] text-tertiary rounded-lg px-3 py-1.5 border border-border-subtle outline-none placeholder-gray-600 font-mono"
                      />
                      {form.reference_url && (
                        <a href={form.reference_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[#FF6F0F] hover:underline whitespace-nowrap shrink-0">
                          🔗 열기
                        </a>
                      )}
                    </div>
                    {/* Suno 원본 링크 */}
                    {form.suno_url && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-dim font-mono truncate flex-1">{form.suno_url}</span>
                        <a href={form.suno_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-purple-400 hover:underline whitespace-nowrap shrink-0">
                          🎵 Suno
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted font-semibold block mb-1.5">아티스트 *</label>
                    <input value={form.artist} onChange={e => setF('artist', e.target.value)}
                      placeholder="Unknown Artist"
                      className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="text-xs text-muted font-semibold block mb-1.5">메인 무드 *</label>
                    <input value={form.mood} onChange={e => setF('mood', e.target.value)}
                      placeholder="chill"
                      className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted font-semibold block mb-1.5">BPM</label>
                      <input value={form.bpm} onChange={e => setF('bpm', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="120" maxLength={3}
                        className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600" />
                    </div>
                    <div>
                      <label className="text-xs text-muted font-semibold block mb-1.5">길이(초)</label>
                      <input value={form.duration_sec} onChange={e => setF('duration_sec', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="180"
                        className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── MP3 업로드 ── */}
              <div>
                <label className="text-xs text-muted font-semibold block mb-2">🎵 오디오 파일 *</label>

                {/* 업로드 버튼 */}
                <div className="flex gap-2 items-stretch">
                  <input ref={audioInputRef} type="file" accept=".mp3,.wav,.aac,.ogg,audio/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; uploadAudio(f); } }} />

                  <button onClick={() => audioInputRef.current?.click()} disabled={audioUploading}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap shrink-0 ${
                      audioUploading
                        ? 'bg-[#FF6F0F]/20 border border-[#FF6F0F]/40 text-[#FF6F0F]/60 cursor-not-allowed'
                        : 'bg-[#FF6F0F]/15 border border-[#FF6F0F]/40 text-[#FF6F0F] hover:bg-[#FF6F0F]/25'
                    }`}>
                    {audioUploading
                      ? <><div className="w-4 h-4 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" /> 업로드 중...</>
                      : <><Upload size={14} /> MP3 재업로드</>
                    }
                  </button>
                </div>

                {/* 업로드 완료 / URL 표시 */}
                {form.audio_url && (
                  <div className="mt-2 flex items-center gap-2 bg-fill-subtle border border-border-subtle rounded-xl px-3 py-2">
                    <Link size={12} className="text-[#FF6F0F] shrink-0" />
                    <a href={form.audio_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-[11px] text-[#FF6F0F]/80 hover:text-[#FF6F0F] font-mono truncate hover:underline"
                      title={form.audio_url}>
                      {audioFileName ? `✅ ${audioFileName}` : form.audio_url}
                    </a>
                    <button onClick={() => {
                      if (testPlaying) {
                        testAudioRef.current?.pause();
                        testAudioRef.current = null;
                        setTestPlaying(false);
                      } else {
                        const a = new Audio(form.audio_url);
                        testAudioRef.current = a;
                        a.play().catch(() => alert('재생 실패 — URL을 확인해주세요'));
                        setTestPlaying(true);
                        a.onended = () => { testAudioRef.current = null; setTestPlaying(false); };
                      }
                    }}
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition whitespace-nowrap shrink-0 ${
                        testPlaying
                          ? 'text-[#FF6F0F] bg-[#FF6F0F]/10 hover:bg-[#FF6F0F]/20'
                          : 'text-tertiary hover:text-primary bg-fill-subtle'
                      }`}>
                      {testPlaying ? <><Pause size={9} /> 테스트 정지</> : <><Play size={9} /> 테스트 재생</>}
                    </button>
                    <button onClick={() => { setF('audio_url', ''); setAudioFileName(''); }}
                      className="text-dim hover:text-red-400 transition shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* ── 무드 태그 ── */}
              <div>
                <label className="text-xs text-muted font-semibold block mb-2">🏷 무드 태그</label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map(t => (
                    <Chip key={t} label={t} active={form.mood_tags.includes(t)} onClick={() => toggleArr('mood_tags', t)} />
                  ))}
                </div>

                {/* Suno 스타일 태그 라이브러리 (접기/펼치기) */}
                <div className="mt-2 pt-2 border-t border-border-main">
                  <button
                    type="button"
                    onClick={() => setSunoTagsOpen(o => !o)}
                    className="flex items-center gap-1.5 text-[11px] text-muted hover:text-secondary transition mb-2">
                    <span>{sunoTagsOpen ? '▾' : '▸'}</span>
                    <span>🎵 Suno 스타일 태그 라이브러리</span>
                    {/* 선택 개수 */}
                    {form.mood_tags.filter((t: string) =>
                      ALL_SUNO_TAGS.includes(t) || customLibTags.some(c => c.tag === t)
                    ).length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#FF6F0F]/20 text-[#FF6F0F] text-[10px]">
                        {form.mood_tags.filter((t: string) =>
                          ALL_SUNO_TAGS.includes(t) || customLibTags.some(c => c.tag === t)
                        ).length}개 선택
                      </span>
                    )}
                    {/* 신규 태그 알림 */}
                    {customLibTags.filter(c =>
                      Date.now() - c.addedAt < NEW_TAG_DAYS * 86400000
                    ).length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px]">
                        NEW {customLibTags.filter(c => Date.now() - c.addedAt < NEW_TAG_DAYS * 86400000).length}
                      </span>
                    )}
                  </button>

                  {sunoTagsOpen && (
                    <div className="space-y-3 bg-white/[0.02] rounded-xl p-3 border border-border-main">

                      {/* 신규 커스텀 태그 섹션 */}
                      {customLibTags.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-tertiary mb-2">📥 임포트·신규 태그</p>
                          <div className="flex flex-wrap gap-1.5">
                            {customLibTags.map(({ tag, addedAt }) => (
                              <LibChip key={tag} label={tag}
                                active={form.mood_tags.includes(tag)}
                                isNew={Date.now() - addedAt < NEW_TAG_DAYS * 86400000}
                                onClick={() => toggleArr('mood_tags', tag)}
                                onDelete={() => deleteLibTag(tag, false)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 내장 Suno 스타일 태그 */}
                      {Object.entries(SUNO_STYLE_TAGS).map(([section, cats]) => (
                        <div key={section}>
                          <p className="text-[11px] font-semibold text-tertiary mb-2">{section}</p>
                          <div className="space-y-2">
                            {Object.entries(cats).map(([catName, tags]) => {
                              const visible = (tags as string[]).filter(t => !hiddenTags.has(t));
                              if (!visible.length) return null;
                              return (
                                <div key={catName} className="flex flex-wrap items-start gap-1.5">
                                  <span className="text-[10px] text-dim w-16 shrink-0 pt-1">{catName}</span>
                                  <div className="flex flex-wrap gap-1.5 flex-1">
                                    {visible.map((t: string) => (
                                      <LibChip key={t} label={t}
                                        active={form.mood_tags.includes(t)}
                                        onClick={() => toggleArr('mood_tags', t)}
                                        onDelete={() => deleteLibTag(t, true)} />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Suno 프롬프트 자동 생성 ── */}
              {form.mood_tags.length > 0 && (() => {
                const tags = form.mood_tags.slice(0, 12);
                const prompt = form.bpm ? `${tags.join(', ')}, ${form.bpm} BPM` : tags.join(', ');
                return (
                  <div className="bg-[#818CF8]/5 border border-[#818CF8]/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#818CF8]">🎼 Suno 프롬프트</span>
                      <span className="text-[10px] text-dim">{tags.length}개 태그{form.bpm ? ` · ${form.bpm} BPM` : ''}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-[11px] text-secondary font-mono leading-relaxed break-all">{prompt}</p>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(prompt).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          });
                        }}
                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${
                          copied
                            ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                            : 'bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#818CF8] hover:bg-[#818CF8]/25'
                        }`}>
                        {copied ? <><ClipboardCheck size={11} /> 복사됨</> : <><Copy size={11} /> 복사</>}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── 시간대 태그 ── */}
              <div>
                <label className="text-xs text-muted font-semibold block mb-2">⏰ 시간대 태그</label>
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map(t => (
                    <Chip key={t} label={TIME_KO[t]} active={form.time_tags.includes(t)} onClick={() => toggleArr('time_tags', t)} />
                  ))}
                </div>
              </div>

              {/* ── Mood Vector 슬라이더 ── */}
              <div className="bg-white/[0.02] border border-border-main rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted">🎚 Mood Vector <span className="font-normal text-dim">(0 ~ 100)</span></p>
                  <button onClick={handleAnalyze} disabled={analyzing || !form.mood_tags.length}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
                      analyzing
                        ? 'bg-purple-500/10 text-purple-400/60 cursor-not-allowed'
                        : form.mood_tags.length
                          ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25'
                          : 'bg-fill-subtle text-dim cursor-not-allowed'
                    }`}>
                    {analyzing
                      ? <><div className="w-3 h-3 border border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> 분석 중...</>
                      : '✨ AI 자동 분석'
                    }
                  </button>
                  <span className="text-[9px] text-purple-400/50 font-mono select-none">Gemini 2.0 Flash</span>
                </div>
                {([
                  { key: 'energy_score',       label: '⚡ 에너지',  color: '#F87171' },
                  { key: 'valence_score',      label: '☀️ 밝음',    color: '#FBBF24' },
                  { key: 'danceability_score', label: '💃 댄서블',  color: '#818CF8' },
                ] as const).map(({ key, label, color }) => {
                  const val = form[key] === '' ? 0 : Number(form[key]);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-[11px] text-muted w-16 shrink-0">{label}</span>
                      <input
                        type="range" min={0} max={100} value={form[key] === '' ? 50 : Number(form[key])}
                        onChange={e => setF(key as any, e.target.value)}
                        className="flex-1 cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      <div className="w-8 text-right">
                        <span className="text-[11px] font-mono" style={{ color: form[key] !== '' ? color : '#4B5563' }}>
                          {form[key] !== '' ? form[key] : '—'}
                        </span>
                      </div>
                      {form[key] !== '' && (
                        <button onClick={() => setF(key as any, '')} className="text-gray-700 hover:text-tertiary transition shrink-0">
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── 가사 ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted font-semibold">📝 가사</label>
                  {form.lyrics && (
                    <span className="text-[10px] text-dim">{form.lyrics.length}자</span>
                  )}
                </div>
                <textarea
                  value={form.lyrics}
                  onChange={e => setF('lyrics', e.target.value)}
                  placeholder={"[Verse 1]\n가사를 입력하세요...\n\n[Chorus]\n..."}
                  rows={6}
                  className="w-full bg-[#1F2937] text-primary text-xs rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600 resize-y font-mono leading-relaxed"
                />
              </div>

              {/* ── 카테고리 + 활성화 ── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted font-semibold block mb-2">📁 카테고리</label>
                  <select value={form.store_category} onChange={e => setF('store_category', e.target.value)}
                    className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none">
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c} value={c}>{CATEGORY_KO[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted font-semibold block mb-2">상태</label>
                  <button onClick={() => setF('is_active', !form.is_active)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition w-full justify-center ${
                      form.is_active
                        ? 'bg-green-500/15 border-green-500/30 text-green-400'
                        : 'bg-fill-subtle border-border-subtle text-muted'
                    }`}>
                    {form.is_active ? <Check size={14} /> : <X size={14} />}
                    {form.is_active ? '활성화' : '비활성'}
                  </button>
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex gap-3 px-6 py-4 border-t border-border-main shrink-0">
              <button onClick={() => { testAudioRef.current?.pause(); testAudioRef.current = null; setTestPlaying(false); setModal(false); }}
                className="flex-1 py-2.5 bg-fill-subtle border border-border-subtle text-tertiary text-sm font-semibold rounded-xl hover:text-primary transition">
                취소
              </button>
              <button onClick={handleSave} disabled={saving || audioUploading || imageUploading}
                className="flex-1 py-2.5 bg-[#FF6F0F] text-primary text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
                  : <><Check size={14} /> {editId ? '수정 완료' : '등록하기'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 미리보기 오버레이 */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={previewUrl} alt="preview" className="h-full max-w-full object-contain" />
            <button onClick={() => setPreviewUrl(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white hover:bg-black/90 flex items-center justify-center transition">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── 카드 렌더러 ──────────────────────────────────────────────
  function renderCard(track: MusicTrack) {
    const isActive  = player.track?.id === track.id;
    const isPlaying = isActive && player.isPlaying;
    const dur = track.duration_sec > 0
      ? `${Math.floor(track.duration_sec / 60)}:${String(track.duration_sec % 60).padStart(2, '0')}`
      : null;
    const plCount = playlistCounts[track.id] ?? 0;
    const bass = isPlaying ? player.bassLevel : 0;
    const moodBg = getMoodGradient(track, isPlaying, bass);
    const genre = (track.mood_tags ?? [])[0] || '';
    const [mc1] = MOOD_COLORS[genre] || DEFAULT_MOOD_COLOR;
    const [r, g, b] = hexToRgb(mc1);
    // 테두리: 베이스에 반응하는 글로우 + 색상 강도
    const borderColor = isPlaying
      ? `rgba(${r},${g},${b},${(0.4 + bass * 0.6).toFixed(2)})`
      : '';
    const borderGlow = isPlaying && bass > 0.2
      ? `0 0 ${Math.round(bass * 16)}px rgba(${r},${g},${b},${(bass * 0.5).toFixed(2)}), inset 0 0 ${Math.round(bass * 8)}px rgba(${r},${g},${b},${(bass * 0.15).toFixed(2)})`
      : 'none';
    return (
      <div key={track.id}
        style={{
          backgroundImage: moodBg,
          borderColor: borderColor || undefined,
          boxShadow: borderGlow,
          borderWidth: isPlaying ? 2 : 1,
          transition: 'border-color 80ms, box-shadow 80ms',
        }}
        className={`group relative flex flex-col rounded-xl overflow-hidden ${
          isPlaying ? 'z-10' : ''
        } ${
          !track.is_active ? 'opacity-50 border border-border-main' : 'border border-border-main hover:border-border-subtle'
        }`}>

                  {/* 커버 — AI 생성 시 9:16 이미지의 중앙 1:1 영역만 표시 */}
                  <div className="relative aspect-square bg-fill-subtle overflow-hidden">
                    {track.cover_image_url ? (
                      <img src={track.cover_image_url} alt={track.title}
                        className="w-full h-full object-cover object-center" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {track.cover_emoji}
                      </div>
                    )}

                    {/* AI 커버 생성 완료 점 */}
                    {track.cover_image_url?.includes('ai_') && (
                      <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-red-500 shadow-lg"></span>
                    )}

                    {/* 런타임 오버레이 */}
                    {dur && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-primary/90 leading-none">
                        {dur}
                      </span>
                    )}

                    {/* 재생 버튼 오버레이 */}
                    <button
                      onClick={() => togglePlay(track)}
                      disabled={!isPlayable(track.audio_url)}
                      className={`absolute inset-0 flex items-center justify-center transition ${
                        isActive
                          ? 'bg-black/20'
                          : 'bg-black/0 group-hover:bg-black/40'
                      } disabled:cursor-not-allowed`}>
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition ${
                        isActive
                          ? 'bg-[#FF6F0F] opacity-100'
                          : 'bg-white opacity-0 group-hover:opacity-100'
                      }`}>
                        {isPlaying
                          ? <Pause size={14} className={isActive ? 'text-primary' : 'text-[#0D0F14]'} />
                          : <Play  size={14} className={isActive ? 'text-primary' : 'text-[#0D0F14] ml-0.5'} />
                        }
                      </span>
                    </button>

                    {/* 커버 이미지 관리 버튼 */}
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition flex gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); handlePasteCover(track); }}
                        disabled={coverUploadId === track.id}
                        className="px-2 py-1 rounded text-[9px] font-semibold bg-black/70 text-white hover:bg-blue-500/70 backdrop-blur-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                        {coverUploadId === track.id ? '⏳' : 'PASTE'}
                      </button>
                    </div>
                  </div>

                  {/* 트랙 정보 */}
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    {track.audio_url && !isPlayable(track.audio_url) && (
                      <p className="text-[9px] font-bold text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 w-fit">외부 URL — 재업로드 필요</p>
                    )}
                    {!track.audio_url && (
                      <p className="text-[9px] font-bold text-dim bg-fill-subtle rounded px-1.5 py-0.5 w-fit">오디오 없음</p>
                    )}
                    <p className="text-primary text-xs font-semibold truncate leading-tight">{track.title}</p>
                    <p className="text-muted text-[10px] truncate">{track.artist}</p>
                    {/* 태그 + 언어 */}
                    {(() => {
                      const lang = getTrackLang(track);
                      const tags = (track.mood_tags ?? []);
                      return (
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {lang && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded leading-none font-semibold border"
                              style={{ backgroundColor: (LANG_COLORS[lang] || '#6b7280') + '20', borderColor: (LANG_COLORS[lang] || '#6b7280') + '40', color: LANG_COLORS[lang] || '#6b7280' }}>
                              {LANG_FLAGS[lang] || '🌐'} {lang}
                            </span>
                          )}
                          {tags.slice(0, 3).map((t, i) => (
                            <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded leading-none ${
                              i === 0
                                ? 'bg-[#FF6F0F]/15 border border-[#FF6F0F]/40 text-[#FF6F0F] font-semibold'
                                : 'bg-fill-subtle border border-border-subtle text-muted'
                            }`}>{t}</span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[9px] px-1 py-0.5 bg-fill-subtle text-dim rounded leading-none">
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* 통계 뱃지 */}
                    <div className="flex items-center gap-2 text-[10px] text-dim mt-0.5">
                      <span className="flex items-center gap-0.5"><Headphones size={9} />{(track.play_count ?? 0).toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><Heart size={9} />{(track.like_count ?? 0).toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><ListMusicIcon size={9} />{plCount}</span>
                      {track.suno_url && (
                        <a href={track.suno_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="p-0.5 rounded text-purple-400/60 hover:text-purple-400 transition-colors">
                          <Link size={9} />
                        </a>
                      )}
                      {track.lyrics && (
                        <span className={`${track.suno_url ? '' : 'ml-auto'} text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20`}>가사</span>
                      )}
                    </div>

                    {/* Mood Vector 바 */}
                    {(track.energy_score != null || track.valence_score != null || track.danceability_score != null) && (
                      <div className="space-y-1 mt-1">
                        {[
                          { val: track.energy_score,       color: '#F87171', label: '⚡' },
                          { val: track.valence_score,      color: '#FBBF24', label: '☀️' },
                          { val: track.danceability_score, color: '#818CF8', label: '💃' },
                        ].map(({ val, color, label }) => val != null ? (
                          <div key={label} className="flex items-center gap-1">
                            <span className="text-[8px] w-3 shrink-0">{label}</span>
                            <div className="flex-1 h-1 bg-fill-subtle rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.round(val * 100)}%`, backgroundColor: color, opacity: 0.8 }} />
                            </div>
                            <span className="text-[8px] font-mono text-dim w-4 text-right">{Math.round(val * 100)}</span>
                          </div>
                        ) : null)}
                      </div>
                    )}

                    {/* 액션 바 */}
                    <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border-main">
                      <button onClick={() => handleToggle(track)} disabled={toggling === track.id}
                        className="flex items-center gap-1 text-[10px] font-semibold transition">
                        {toggling === track.id
                          ? <div className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
                          : track.is_active
                            ? <><ToggleRight size={14} className="text-green-400" /><span className="text-green-400">활성</span></>
                            : <><ToggleLeft  size={14} className="text-dim"  /><span className="text-dim">비활성</span></>
                        }
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(track)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-fill-subtle text-muted hover:text-primary transition">
                          <Pencil size={11} />
                        </button>
                        <button onClick={() => handleDelete(track)} disabled={deleting === track.id}
                          className="w-6 h-6 flex items-center justify-center rounded bg-red-500/10 text-red-400 hover:text-red-300 transition disabled:opacity-50">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
  }
}
