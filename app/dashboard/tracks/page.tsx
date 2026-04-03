'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Check, Play, Pause, Upload, ImagePlus, Link, Heart, ListMusic as ListMusicIcon, ArrowDownUp, Headphones } from 'lucide-react';
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
  play_count?:     number | null;
  like_count?:     number | null;
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
  cover_emoji:     '🎵',
  is_active:       true,
  reference_url:   '',
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
          : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
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
            : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
        }`}>
        {label}
        {isNew && (
          <span className="ml-1.5 text-[8px] font-bold bg-green-500 text-white rounded px-1 py-0.5 align-middle">NEW</span>
        )}
      </button>
      {/* X 버튼: 호버 시 표시 */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="라이브러리에서 삭제"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center rounded-full text-gray-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover/lc:opacity-100 transition">
        <X size={8} />
      </button>
    </div>
  );
}

// ─── 이미지를 1:1 정사각형으로 크롭 (canvas) ──────────────────
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

  const [tracks,         setTracks]         = useState<MusicTrack[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [query,          setQuery]          = useState('');
  const [catFilter,      setCatFilter]      = useState('all');
  const [tagFilter,      setTagFilter]      = useState('');
  const [toggling,       setToggling]       = useState<string | null>(null);
  const [deleting,       setDeleting]       = useState<string | null>(null);
  const [playlistCounts, setPlaylistCounts] = useState<Record<string, number>>({});
  const [sortOrder,      setSortOrder]      = useState<'latest' | 'plays' | 'likes' | 'playlists'>('latest');

  // 모달
  const [modal,  setModal]  = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState(EMPTY_FORM);

  // Suno 태그 라이브러리 (localStorage 기반)
  const [customLibTags, setCustomLibTags] = useState<LibTag[]>([]);
  const [hiddenTags,    setHiddenTags]    = useState<Set<string>>(new Set());
  const [sunoTagsOpen,  setSunoTagsOpen]  = useState(false);

  // 업로드 상태
  const [audioUploading, setAudioUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [audioFileName,  setAudioFileName]  = useState('');

  useEffect(() => {
    load();
    // 커스텀 태그 라이브러리 로드
    try {
      const ct: LibTag[] = JSON.parse(localStorage.getItem(LS_CUSTOM_TAGS) || '[]');
      const ht: string[] = JSON.parse(localStorage.getItem(LS_HIDDEN_TAGS) || '[]');
      setCustomLibTags(ct);
      setHiddenTags(new Set(ht));
    } catch {}
  }, []);

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

  // ── 태그 집계 (mood_tags 배열만) ──
  const tagCounts = tracks.reduce<Record<string, number>>((acc, t) => {
    (t.mood_tags || []).forEach(tag => {
      if (MOOD_OPTIONS.includes(tag)) acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  // ── 필터 + 정렬 ──
  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = tracks.filter(t => {
    const q = query.toLowerCase();
    const matchQ = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.mood.toLowerCase().includes(q);
    const matchC = catFilter === 'all' || t.store_category === catFilter || t.store_category === 'all';
    const matchT = !tagFilter || (t.mood_tags || []).includes(tagFilter);
    return matchQ && matchC && matchT;
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
      cover_emoji:     t.cover_emoji,
      is_active:       t.is_active,
      reference_url:   t.reference_url ?? '',
    });
    setModal(true);
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
        reference_url:   form.reference_url.trim() || null,
      };

      if (editId) {
        const { error } = await sb.from('music_tracks').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await sb.from('music_tracks').insert(payload);
        if (error) throw error;
      }

      await load();
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
  const handleDelete = async (t: MusicTrack) => {
    if (!confirm(`"${t.title}" 트랙을 삭제할까요?`)) return;
    setDeleting(t.id);
    await sb.from('music_tracks').delete().eq('id', t.id);
    setTracks(prev => prev.filter(tr => tr.id !== t.id));
    setDeleting(null);
  };

  // ── 재생 (하단 플레이어로 연결) ──
  const togglePlay = (track: MusicTrack) => {
    const playable = {
      id:              track.id,
      title:           track.title,
      artist:          track.artist,
      audio_url:       track.audio_url,
      cover_image_url: track.cover_image_url,
      cover_emoji:     track.cover_emoji,
      duration_sec:    track.duration_sec,
      mood:            track.mood,
    };
    if (player.track?.id === track.id) {
      player.togglePlay();
    } else {
      player.play(playable, filtered.map(t => ({
        id: t.id, title: t.title, artist: t.artist,
        audio_url: t.audio_url, cover_image_url: t.cover_image_url,
        cover_emoji: t.cover_emoji, duration_sec: t.duration_sec, mood: t.mood,
      })));
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <h1 className="text-lg font-bold text-white">🎵 트랙 관리</h1>
          <p className="text-xs text-gray-500 mt-0.5">music_tracks 테이블 · 총 {tracks.length}개</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 transition">
          <Plus size={15} /> 새 트랙 등록
        </button>
      </div>

      {/* 무드 태그 필터 */}
      {sortedTags.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-white/5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTagFilter('')}
            className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
              !tagFilter ? 'bg-[#FF6F0F] text-white' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}>
            전체 <span className="opacity-60">{tracks.length}</span>
          </button>
          {sortedTags.map(([tag, count]) => (
            <button key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                tagFilter === tag
                  ? 'bg-[#FF6F0F] text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}>
              {tag}
              <span className={`text-[10px] ${tagFilter === tag ? 'opacity-70' : 'opacity-50'}`}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="제목, 아티스트, 무드 검색..."
            className="w-full pl-8 pr-3 py-2 bg-[#1A1D23] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 outline-none" />
        </div>
        <div className="flex gap-1">
          {['all', ...CATEGORY_OPTIONS.filter(c => c !== 'all')].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                catFilter === c ? 'bg-[#FF6F0F] text-white' : 'text-gray-400 hover:text-white bg-white/5'
              }`}>
              {CATEGORY_KO[c] ?? c}
            </button>
          ))}
        </div>
        {/* 정렬 */}
        <div className="flex gap-1 ml-auto">
          <ArrowDownUp size={13} className="text-gray-600 self-center" />
          {([['latest','최신순'],['plays','재생순'],['likes','좋아요순'],['playlists','플리순']] as const).map(([v,label]) => (
            <button key={v} onClick={() => setSortOrder(v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                sortOrder === v ? 'bg-[#FF6F0F] text-white' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-600">{sorted.length}개</span>
      </div>

      {/* 트랙 목록 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3">
            <div className="w-6 h-6 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">🎵</span>
            <p className="text-gray-500 text-sm">트랙이 없어요</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
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
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">이전 트랙 · {olderTracks.length}개</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
              </>
            )}
            {/* 이전 트랙 or 전체(비최신순) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {(sortOrder === 'latest' ? olderTracks : sorted).map(track => renderCard(track))}
            </div>
          </div>
        )}
      </div>
      {/* ── 등록/편집 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#13161D] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
              <h2 className="text-base font-bold text-white">
                {editId ? '✏️ 트랙 수정' : '➕ 새 트랙 등록'}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {/* 폼 */}
            <div className="flex-1 overflow-auto px-6 py-5 space-y-5">

              {/* ── 커버 이미지 + 제목/아티스트/무드 ── */}
              <div className="flex gap-4 items-start">

                {/* 커버 이미지 업로드 */}
                <div className="shrink-0 space-y-2">
                  <label className="text-xs text-gray-500 font-semibold block">커버 이미지</label>

                  {/* 1:1 미리보기 */}
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="relative w-28 h-28 rounded-xl overflow-hidden bg-[#1F2937] border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-[#FF6F0F]/50 transition group">
                    {form.cover_image_url ? (
                      <img src={form.cover_image_url} alt="cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-3xl">{form.cover_emoji}</span>
                        <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition">클릭하여 업로드</span>
                      </div>
                    )}
                    {imageUploading && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-[#FF6F0F]/30 border-t-[#FF6F0F] rounded-full animate-spin" />
                      </div>
                    )}
                    {/* 1:1 배지 */}
                    <div className="absolute top-1.5 right-1.5 bg-black/60 text-[9px] text-gray-400 px-1.5 py-0.5 rounded-md font-mono">1:1</div>
                  </div>

                  {/* 숨겨진 파일 입력 */}
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ''; uploadImage(f); } }} />

                  <div className="flex gap-1">
                    <button onClick={() => imageInputRef.current?.click()} disabled={imageUploading}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold bg-white/5 border border-white/10 text-gray-400 rounded-lg hover:text-white hover:border-white/20 transition disabled:opacity-40">
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
                      <p className="text-[10px] text-gray-600 mb-1">이모지 (이미지 없을 때)</p>
                      <div className="flex flex-wrap gap-1 w-28">
                        {EMOJI_OPTIONS.map(e => (
                          <button key={e} onClick={() => setF('cover_emoji', e)}
                            className={`w-6 h-6 rounded-md text-sm flex items-center justify-center transition ${
                              form.cover_emoji === e ? 'bg-[#FF6F0F]/20 border border-[#FF6F0F]' : 'bg-white/5 border border-white/10 hover:border-white/20'
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
                    <label className="text-xs text-gray-500 font-semibold block mb-1.5">제목 *</label>
                    <input value={form.title} onChange={e => handleTitleChange(e.target.value)}
                      placeholder="Morning Breeze  (또는 [@handle] Morning Breeze 형식으로 입력 시 레퍼런스 자동 분리)"
                      className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600" />
                    {/* 레퍼런스 URL — [핸들] 패턴에서 자동 추출 또는 직접 입력 */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        value={form.reference_url}
                        onChange={e => setF('reference_url', e.target.value)}
                        placeholder="https://www.youtube.com/@handle/"
                        className="flex-1 bg-[#1F2937] text-[11px] text-gray-400 rounded-lg px-3 py-1.5 border border-white/10 outline-none placeholder-gray-600 font-mono"
                      />
                      {form.reference_url && (
                        <a href={form.reference_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[#FF6F0F] hover:underline whitespace-nowrap shrink-0">
                          🔗 열기
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1.5">아티스트 *</label>
                    <input value={form.artist} onChange={e => setF('artist', e.target.value)}
                      placeholder="Unknown Artist"
                      className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1.5">메인 무드 *</label>
                    <input value={form.mood} onChange={e => setF('mood', e.target.value)}
                      placeholder="chill"
                      className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 font-semibold block mb-1.5">BPM</label>
                      <input value={form.bpm} onChange={e => setF('bpm', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="120" maxLength={3}
                        className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold block mb-1.5">길이(초)</label>
                      <input value={form.duration_sec} onChange={e => setF('duration_sec', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="180"
                        className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── MP3 업로드 ── */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-2">🎵 오디오 파일 *</label>

                {/* 업로드 버튼 + URL 입력 */}
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
                      : <><Upload size={14} /> MP3 업로드</>
                    }
                  </button>

                  <input value={form.audio_url} onChange={e => setF('audio_url', e.target.value)}
                    placeholder="또는 URL 직접 입력 (https://...)"
                    className="flex-1 bg-[#1F2937] text-white text-xs rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600 font-mono" />
                </div>

                {/* 업로드 완료 / URL 표시 */}
                {form.audio_url && (
                  <div className="mt-2 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <Link size={12} className="text-[#FF6F0F] shrink-0" />
                    <a href={form.audio_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-[11px] text-[#FF6F0F]/80 hover:text-[#FF6F0F] font-mono truncate hover:underline"
                      title={form.audio_url}>
                      {audioFileName ? `✅ ${audioFileName}` : form.audio_url}
                    </a>
                    <button onClick={() => {
                      // no audioRef
                      const a = new Audio(form.audio_url);
                      a.play().catch(() => alert('재생 실패 — URL을 확인해주세요'));
                    }}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white px-2 py-1 bg-white/5 rounded-lg transition whitespace-nowrap shrink-0">
                      <Play size={9} /> 테스트
                    </button>
                    <button onClick={() => { setF('audio_url', ''); setAudioFileName(''); }}
                      className="text-gray-600 hover:text-red-400 transition shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* ── 무드 태그 ── */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-2">🏷 무드 태그</label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map(t => (
                    <Chip key={t} label={t} active={form.mood_tags.includes(t)} onClick={() => toggleArr('mood_tags', t)} />
                  ))}
                </div>

                {/* Suno 스타일 태그 라이브러리 (접기/펼치기) */}
                <div className="mt-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setSunoTagsOpen(o => !o)}
                    className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition mb-2">
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
                    <div className="space-y-3 bg-white/[0.02] rounded-xl p-3 border border-white/5">

                      {/* 신규 커스텀 태그 섹션 */}
                      {customLibTags.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-gray-400 mb-2">📥 임포트·신규 태그</p>
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
                          <p className="text-[11px] font-semibold text-gray-400 mb-2">{section}</p>
                          <div className="space-y-2">
                            {Object.entries(cats).map(([catName, tags]) => {
                              const visible = (tags as string[]).filter(t => !hiddenTags.has(t));
                              if (!visible.length) return null;
                              return (
                                <div key={catName} className="flex flex-wrap items-start gap-1.5">
                                  <span className="text-[10px] text-gray-600 w-16 shrink-0 pt-1">{catName}</span>
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

              {/* ── 시간대 태그 ── */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-2">⏰ 시간대 태그</label>
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map(t => (
                    <Chip key={t} label={TIME_KO[t]} active={form.time_tags.includes(t)} onClick={() => toggleArr('time_tags', t)} />
                  ))}
                </div>
              </div>

              {/* ── 에너지 + 카테고리 + 활성화 ── */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-2">⚡ 에너지</label>
                  <div className="flex gap-2">
                    {ENERGY_OPTIONS.map(e => (
                      <button key={e} onClick={() => setF('energy_level', form.energy_level === e ? '' : e)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          form.energy_level === e
                            ? e === 'high'   ? 'bg-red-500/20 border border-red-500 text-red-400'
                            : e === 'medium' ? 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'
                            :                  'bg-green-500/20 border border-green-500 text-green-400'
                            : 'bg-white/5 border border-white/10 text-gray-400'
                        }`}>
                        {ENERGY_KO[e]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-2">📁 카테고리</label>
                  <select value={form.store_category} onChange={e => setF('store_category', e.target.value)}
                    className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none">
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c} value={c}>{CATEGORY_KO[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-2">상태</label>
                  <button onClick={() => setF('is_active', !form.is_active)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition w-full justify-center ${
                      form.is_active
                        ? 'bg-green-500/15 border-green-500/30 text-green-400'
                        : 'bg-white/5 border-white/10 text-gray-500'
                    }`}>
                    {form.is_active ? <Check size={14} /> : <X size={14} />}
                    {form.is_active ? '활성화' : '비활성'}
                  </button>
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex gap-3 px-6 py-4 border-t border-white/5 shrink-0">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold rounded-xl hover:text-white transition">
                취소
              </button>
              <button onClick={handleSave} disabled={saving || audioUploading || imageUploading}
                className="flex-1 py-2.5 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
                  : <><Check size={14} /> {editId ? '수정 완료' : '등록하기'}</>
                }
              </button>
            </div>
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
    return (
      <div key={track.id}
        className={`group relative flex flex-col rounded-xl overflow-hidden bg-white/[0.03] border transition hover:bg-white/[0.06] ${
          !track.is_active ? 'opacity-50' : 'border-white/5 hover:border-white/10'
        }`}>

                  {/* 커버 */}
                  <div className="relative aspect-square bg-white/5">
                    {track.cover_image_url ? (
                      <img src={track.cover_image_url} alt={track.title}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {track.cover_emoji}
                      </div>
                    )}

                    {/* 런타임 오버레이 */}
                    {dur && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white/90 leading-none">
                        {dur}
                      </span>
                    )}

                    {/* 재생 버튼 오버레이 */}
                    <button
                      onClick={() => togglePlay(track)}
                      disabled={!track.audio_url}
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
                          ? <Pause size={14} className={isActive ? 'text-white' : 'text-[#0D0F14]'} />
                          : <Play  size={14} className={isActive ? 'text-white' : 'text-[#0D0F14] ml-0.5'} />
                        }
                      </span>
                    </button>
                  </div>

                  {/* 트랙 정보 */}
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <p className="text-white text-xs font-semibold truncate leading-tight">{track.title}</p>
                    <p className="text-gray-500 text-[10px] truncate">{track.artist}</p>
                    {track.mood && (
                      <p className="text-[#FF6F0F] text-[10px] font-semibold truncate">{track.mood}</p>
                    )}

                    {/* 태그 */}
                    {(track.mood_tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {(track.mood_tags ?? []).slice(0, 3).map(t => (
                          <span key={t} className="text-[9px] px-1 py-0.5 bg-white/5 border border-white/10 text-gray-500 rounded leading-none">{t}</span>
                        ))}
                        {(track.mood_tags ?? []).length > 3 && (
                          <span className="text-[9px] px-1 py-0.5 bg-[#FF6F0F]/10 text-[#FF6F0F] rounded leading-none">
                            +{(track.mood_tags ?? []).length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 통계 뱃지 */}
                    <div className="flex items-center gap-2 text-[10px] text-gray-600 mt-0.5">
                      <span className="flex items-center gap-0.5"><Headphones size={9} />{(track.play_count ?? 0).toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><Heart size={9} />{(track.like_count ?? 0).toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><ListMusicIcon size={9} />{plCount}</span>
                    </div>

                    {/* 액션 바 */}
                    <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-white/5">
                      <button onClick={() => handleToggle(track)} disabled={toggling === track.id}
                        className="flex items-center gap-1 text-[10px] font-semibold transition">
                        {toggling === track.id
                          ? <div className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
                          : track.is_active
                            ? <><ToggleRight size={14} className="text-green-400" /><span className="text-green-400">활성</span></>
                            : <><ToggleLeft  size={14} className="text-gray-600"  /><span className="text-gray-600">비활성</span></>
                        }
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(track)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-gray-500 hover:text-white transition">
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
