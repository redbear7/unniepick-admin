'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  Search, Plus, Pencil, Trash2, X, Check, Tag, Music, Building2,
  AtSign, Link2, Link2Off, Play, Pause, ListPlus, CheckSquare, Square, GripVertical,
} from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

// ─── 타입 ─────────────────────────────────────────────────────
interface Brand {
  id:          string;
  name:        string;
  handle:      string;
  color:       string;
  description: string;
  tags:        string[];
  is_active:   boolean;
  created_at:  string;
}

interface MusicTrack {
  id:              string;
  title:           string;
  artist:          string;
  mood:            string;
  mood_tags:       string[];
  cover_image_url: string | null;
  cover_emoji:     string;
  audio_url:       string;
  duration_sec:    number;
  is_active:       boolean;
}

// ─── 기본 브랜드 샘플 ─────────────────────────────────────────
const DEFAULT_BRANDS: Omit<Brand, 'id' | 'created_at'>[] = [
  { name: '해쉬커피',  handle: 'hashcoffee', color: '#6F4E37', description: '스페셜티 커피 브랜드',   tags: ['cozy','lo-fi','acoustic','morning-coffee','warm','chill'], is_active: true },
  { name: '스타벅스',  handle: 'starbucks',  color: '#00704A', description: '글로벌 커피 브랜드',     tags: ['jazz','acoustic','lounge','ambient','chill','bright'],     is_active: true },
  { name: '더로드101', handle: 'theroad101', color: '#1A1A2E', description: '프리미엄 바 & 라운지',   tags: ['jazz','r&b','lounge','night','ambient','indie'],           is_active: true },
  { name: '이마트',    handle: 'emart',      color: '#FFD700', description: '대형 마트 & 리테일',     tags: ['upbeat','bright','pop','k-pop','energetic','fresh'],       is_active: true },
];

const LS_BRANDS = 'dashboard_brands_v2';

function loadBrands(): Brand[] {
  try {
    const saved = localStorage.getItem(LS_BRANDS);
    if (saved) return JSON.parse(saved).map((b: Brand) => ({ ...b, handle: b.handle || '' }));
  } catch {}
  const defaults: Brand[] = DEFAULT_BRANDS.map((b, i) => ({
    ...b, id: `brand_${i + 1}`, created_at: new Date().toISOString(),
  }));
  localStorage.setItem(LS_BRANDS, JSON.stringify(defaults));
  return defaults;
}

const BRAND_COLORS = [
  '#FF6F0F','#6F4E37','#00704A','#1A1A2E','#FFD700','#E91E63','#9C27B0',
  '#3F51B5','#009688','#F44336','#FF9800','#607D8B','#795548','#4CAF50',
];

const EMPTY_FORM = { name: '', handle: '', color: '#FF6F0F', description: '', tags: [] as string[], is_active: true };

function normalizeHandle(raw: string) {
  return raw.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}
function fmtDur(sec: number) {
  return sec > 0 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : null;
}

// ─── 곡 추가 모달 (10초 미리듣기 + 무드태그) ──────────────────
function AddTrackModal({
  brand, tracks, onAdd, onRemove, onClose,
}: {
  brand: Brand; tracks: MusicTrack[];
  onAdd: (t: MusicTrack) => Promise<void>;
  onRemove: (t: MusicTrack) => Promise<void>;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [linking, setLinking]   = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handle = `@${brand.handle}`;

  const filtered = useMemo(() =>
    tracks.filter(t => !q || t.title.toLowerCase().includes(q.toLowerCase()) || t.artist.toLowerCase().includes(q.toLowerCase())),
  [tracks, q]);

  // 모달 닫힐 때 미리듣기 정리
  useEffect(() => () => {
    audioRef.current?.pause();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const togglePreview = (t: MusicTrack) => {
    if (previewId === t.id) {
      // 정지
      audioRef.current?.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
      setPreviewId(null);
    } else {
      // 기존 정지 후 새로 재생
      audioRef.current?.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!t.audio_url) return;
      const audio = new Audio(t.audio_url);
      audio.volume = 0.7;
      audio.play().catch(() => {});
      audioRef.current = audio;
      setPreviewId(t.id);
      // 10초 후 자동 정지
      timerRef.current = setTimeout(() => {
        audio.pause();
        setPreviewId(null);
      }, 10000);
      audio.onended = () => setPreviewId(null);
    }
  };

  const toggleLink = async (t: MusicTrack) => {
    setLinking(t.id);
    if (t.mood_tags.includes(handle)) await onRemove(t);
    else await onAdd(t);
    setLinking(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#13161D] border border-border-subtle rounded-2xl w-full max-w-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-main shrink-0">
          <div>
            <h2 className="text-sm font-bold text-primary flex items-center gap-2">
              <Music size={14} className="text-[#FF6F0F]" /> 곡에 브랜드 연결
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              <span className="text-[#FF6F0F] font-mono">{handle}</span> 태그를 곡에 추가/제거 · ▷ 버튼으로 10초 미리듣기
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary transition"><X size={18} /></button>
        </div>

        <div className="px-4 py-3 border-b border-border-main shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="곡 제목, 아티스트 검색..."
              className="w-full pl-8 pr-3 py-2 bg-card border border-border-subtle rounded-xl text-xs text-primary placeholder-gray-600 outline-none" />
          </div>
        </div>

        <div className="flex-1 overflow-auto py-1">
          {filtered.map(t => {
            const linked     = t.mood_tags.includes(handle);
            const isPreviewing = previewId === t.id;
            const visibleTags = (t.mood_tags ?? []).filter(tag => !tag.startsWith('@')).slice(0, 4);
            return (
              <div key={t.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition ${isPreviewing ? 'bg-[#FF6F0F]/5' : ''}`}>
                {/* 미리듣기 버튼 */}
                <button onClick={() => togglePreview(t)} disabled={!t.audio_url}
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition disabled:opacity-30 ${
                    isPreviewing ? 'bg-[#FF6F0F] text-primary' : 'bg-fill-medium text-tertiary hover:bg-white/20 hover:text-primary'
                  }`}>
                  {isPreviewing ? <Pause size={10} /> : <Play size={10} className="ml-0.5" />}
                </button>

                {/* 커버 */}
                <div className="w-9 h-9 rounded-lg bg-fill-subtle flex items-center justify-center shrink-0 overflow-hidden">
                  {t.cover_image_url
                    ? <img src={t.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-base">{t.cover_emoji}</span>}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary truncate">{t.title}</p>
                  <p className="text-[10px] text-muted truncate">{t.artist}</p>
                  {/* 무드태그 */}
                  {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {visibleTags.map(tag => (
                        <span key={tag} className="text-[8px] px-1 py-0.5 bg-fill-subtle border border-border-subtle text-muted rounded leading-none">{tag}</span>
                      ))}
                      {(t.mood_tags ?? []).filter(tag => !tag.startsWith('@')).length > 4 && (
                        <span className="text-[8px] px-1 py-0.5 bg-fill-subtle text-dim rounded leading-none">
                          +{(t.mood_tags ?? []).filter(tag => !tag.startsWith('@')).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 연결 배지 */}
                {linked && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FF6F0F]/15 text-[#FF6F0F] font-mono shrink-0">{handle}</span>
                )}

                {/* 연결/해제 버튼 */}
                <button onClick={() => toggleLink(t)} disabled={linking === t.id}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition disabled:opacity-50 ${
                    linked
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                      : 'bg-[#FF6F0F]/10 border border-[#FF6F0F]/30 text-[#FF6F0F] hover:bg-[#FF6F0F]/20'
                  }`}>
                  {linking === t.id
                    ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    : linked ? <><Link2Off size={10} /> 해제</> : <><Link2 size={10} /> 연결</>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-border-main shrink-0">
          <button onClick={onClose}
            className="w-full py-2 bg-fill-subtle border border-border-subtle text-tertiary text-xs font-semibold rounded-xl hover:text-primary transition">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 플레이리스트 생성 모달 ───────────────────────────────────
function CreatePlaylistModal({
  tracks, brandName, onClose, onDone,
}: {
  tracks: MusicTrack[]; brandName: string; onClose: () => void; onDone: () => void;
}) {
  const [name, setName]   = useState(`${brandName} 플레이리스트`);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { alert('플레이리스트 이름을 입력해주세요'); return; }
    setSaving(true);
    const sb = createClient();
    try {
      const { data: pl } = await sb
        .from('playlists')
        .insert({ name: name.trim(), is_active: true, is_curated: true, is_dynamic: false, mood_tags: [], time_tags: [], weather_tags: [], category_tags: [] })
        .select('id').single();
      if (!pl) throw new Error('플레이리스트 생성 실패');
      await sb.from('playlist_tracks').insert(
        tracks.map((t, i) => ({ playlist_id: pl.id, track_id: t.id, position: i }))
      );
      onDone();
    } catch (e: any) {
      alert(`실패: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#13161D] border border-border-subtle rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-main">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <ListPlus size={14} className="text-[#FF6F0F]" /> 플레이리스트 만들기
          </h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs text-muted font-semibold block mb-1.5">플레이리스트 이름</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none" />
          </div>
          <p className="text-xs text-muted">선택한 곡 <span className="text-primary font-bold">{tracks.length}개</span>를 포함합니다</p>
          <div className="max-h-40 overflow-auto space-y-1">
            {tracks.map(t => (
              <div key={t.id} className="flex items-center gap-2 py-1">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-fill-subtle shrink-0 overflow-hidden">
                  {t.cover_image_url
                    ? <img src={t.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs">{t.cover_emoji}</span>}
                </div>
                <p className="text-xs text-secondary truncate flex-1">{t.title}</p>
                <p className="text-[10px] text-dim shrink-0">{t.artist}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-border-main">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-fill-subtle border border-border-subtle text-tertiary text-sm font-semibold rounded-xl hover:text-primary transition">
            취소
          </button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 py-2.5 bg-[#FF6F0F] text-primary text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Check size={14} /> 만들기</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────
export default function BrandsPage() {
  const sb     = createClient();
  const player = usePlayer();

  const [brands,   setBrands]   = useState<Brand[]>([]);
  const [tracks,   setTracks]   = useState<MusicTrack[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState<Brand | null>(null);

  const [selTrackIds, setSelTrackIds] = useState<Set<string>>(new Set());

  const [modal,    setModal]    = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');

  const [addModal,      setAddModal]      = useState(false);
  const [playlistModal, setPlaylistModal] = useState(false);

  const [brandTrackOrder, setBrandTrackOrder] = useState<Record<string, string[]>>({});
  const dragBrandTrack = useRef<string | null>(null);
  const [dragOverBrandTrack, setDragOverBrandTrack] = useState<string | null>(null);

  useEffect(() => {
    setBrands(loadBrands());
    try {
      const saved = JSON.parse(localStorage.getItem('dashboard_brand_track_orders') || '{}');
      setBrandTrackOrder(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await sb
        .from('music_tracks')
        .select('id, title, artist, mood, mood_tags, cover_image_url, cover_emoji, audio_url, duration_sec, is_active')
        .order('created_at', { ascending: false });
      setTracks((data ?? []) as MusicTrack[]);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setSelTrackIds(new Set()); }, [selected?.id]);

  const saveBrandTrackOrder = (brandId: string, ids: string[]) => {
    setBrandTrackOrder(prev => {
      const next = { ...prev, [brandId]: ids };
      localStorage.setItem('dashboard_brand_track_orders', JSON.stringify(next));
      return next;
    });
  };

  const handleBrandTrackDragStart = (id: string) => { dragBrandTrack.current = id; };
  const handleBrandTrackDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverBrandTrack(id); };
  const handleBrandTrackDrop      = (targetId: string) => {
    if (!selected) return;
    const fromId = dragBrandTrack.current;
    if (!fromId || fromId === targetId) { setDragOverBrandTrack(null); return; }
    const order = brandTrackOrder[selected.id] ?? brandTracks.map(t => t.id);
    const orderedIds = (() => {
      const idSet = new Set(brandTracks.map(t => t.id));
      const base = order.filter(id => idSet.has(id));
      const baseSet = new Set(base);
      return [...base, ...brandTracks.filter(t => !baseSet.has(t.id)).map(t => t.id)];
    })();
    const fi = orderedIds.indexOf(fromId);
    const ti = orderedIds.indexOf(targetId);
    orderedIds.splice(fi, 1);
    orderedIds.splice(ti, 0, fromId);
    saveBrandTrackOrder(selected.id, orderedIds);
    dragBrandTrack.current = null;
    setDragOverBrandTrack(null);
  };

  const saveBrands = (next: Brand[]) => {
    setBrands(next);
    localStorage.setItem(LS_BRANDS, JSON.stringify(next));
    if (selected) setSelected(next.find(b => b.id === selected.id) ?? null);
  };

  const brandTracks = useMemo(() => {
    if (!selected?.handle) return [];
    const handle = `@${selected.handle}`;
    const raw = tracks.filter(t => (t.mood_tags ?? []).includes(handle));
    const order = brandTrackOrder[selected.id];
    if (!order?.length) return raw;
    const idSet = new Set(raw.map(t => t.id));
    const ordered = order.filter(id => idSet.has(id));
    const orderedSet = new Set(ordered);
    return [...ordered.map(id => raw.find(t => t.id === id)!), ...raw.filter(t => !orderedSet.has(t.id))];
  }, [selected, tracks, brandTrackOrder]);

  const selectedTracks = useMemo(
    () => brandTracks.filter(t => selTrackIds.has(t.id)),
    [brandTracks, selTrackIds]
  );

  const filteredBrands = brands.filter(b =>
    !query || b.name.toLowerCase().includes(query.toLowerCase()) ||
    b.handle.toLowerCase().includes(query.toLowerCase()) ||
    b.description.toLowerCase().includes(query.toLowerCase())
  );

  const setF = (key: keyof typeof EMPTY_FORM, val: any) => setForm(f => ({ ...f, [key]: val }));

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setTagInput(''); setModal(true); };
  const openEdit   = (b: Brand) => {
    setEditId(b.id);
    setForm({ name: b.name, handle: b.handle, color: b.color, description: b.description, tags: [...b.tags], is_active: b.is_active });
    setTagInput(''); setModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { alert('브랜드명을 입력해주세요'); return; }
    const handle = normalizeHandle(form.handle);
    const dup = brands.find(b => b.handle === handle && b.id !== editId);
    if (handle && dup) { alert(`@${handle} 은 이미 "${dup.name}" 브랜드에서 사용 중입니다`); return; }
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), handle };
    if (editId) {
      saveBrands(brands.map(b => b.id === editId ? { ...b, ...payload } : b));
    } else {
      saveBrands([...brands, { id: `brand_${Date.now()}`, ...payload, created_at: new Date().toISOString() }]);
    }
    setSaving(false); setModal(false);
  };

  const handleDelete = (b: Brand) => {
    if (!confirm(`"${b.name}" 브랜드를 삭제할까요?`)) return;
    saveBrands(brands.filter(x => x.id !== b.id));
    if (selected?.id === b.id) setSelected(null);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || form.tags.includes(t)) { setTagInput(''); return; }
    setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };
  const removeTag = (tag: string) => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));

  const addTrackToBrand = async (track: MusicTrack) => {
    if (!selected?.handle) return;
    const handle = `@${selected.handle}`;
    const newTags = [...(track.mood_tags ?? []), handle];
    await sb.from('music_tracks').update({ mood_tags: newTags }).eq('id', track.id);
    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, mood_tags: newTags } : t));
  };
  const removeTrackFromBrand = async (track: MusicTrack) => {
    if (!selected?.handle) return;
    const handle = `@${selected.handle}`;
    const newTags = (track.mood_tags ?? []).filter(t => t !== handle);
    await sb.from('music_tracks').update({ mood_tags: newTags }).eq('id', track.id);
    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, mood_tags: newTags } : t));
  };

  const toPlayable = (t: MusicTrack) => ({
    id: t.id, title: t.title, artist: t.artist, audio_url: t.audio_url,
    cover_image_url: t.cover_image_url, cover_emoji: t.cover_emoji,
    duration_sec: t.duration_sec, mood: t.mood,
  });
  const togglePlay = (track: MusicTrack) => {
    if (player.track?.id === track.id) player.togglePlay();
    else player.play(toPlayable(track), brandTracks.map(toPlayable));
  };

  const toggleSel = (id: string) => setSelTrackIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAll   = () => setSelTrackIds(new Set(brandTracks.map(t => t.id)));
  const deselectAll = () => setSelTrackIds(new Set());

  return (
    <div className="flex h-full">
      {/* ── 왼쪽: 브랜드 목록 ── */}
      <div className="w-72 shrink-0 border-r border-border-main flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-main">
          <div>
            <h1 className="text-base font-bold text-primary flex items-center gap-2">
              <Building2 size={16} className="text-[#FF6F0F]" /> 브랜드관
            </h1>
            <p className="text-[11px] text-muted mt-0.5">@핸들로 곡 · 플레이리스트 연결</p>
          </div>
          <button onClick={openCreate}
            className="w-8 h-8 flex items-center justify-center bg-[#FF6F0F] text-primary rounded-xl hover:bg-[#FF6F0F]/90 transition">
            <Plus size={14} />
          </button>
        </div>
        <div className="px-3 py-2.5 border-b border-border-main">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="브랜드, @핸들 검색..."
              className="w-full pl-8 pr-3 py-2 bg-card border border-border-subtle rounded-xl text-xs text-primary placeholder-gray-600 outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {filteredBrands.map(b => {
            const linked = b.handle ? tracks.filter(t => (t.mood_tags ?? []).includes(`@${b.handle}`)).length : 0;
            const isSel  = selected?.id === b.id;
            return (
              <button key={b.id} onClick={() => setSelected(isSel ? null : b)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                  isSel ? 'bg-[#FF6F0F]/10 border-l-2 border-[#FF6F0F]' : 'hover:bg-fill-medium border-l-2 border-transparent'
                } ${!b.is_active ? 'opacity-50' : ''}`}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: b.color + '30', border: `2px solid ${b.color}50` }}>
                  <span className="text-base font-black" style={{ color: b.color }}>{b.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">{b.name}</p>
                  <p className="text-[10px] font-mono text-dim truncate">{b.handle ? `@${b.handle}` : '핸들 없음'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-tertiary">{linked}</p>
                  <p className="text-[9px] text-dim">연결됨</p>
                </div>
              </button>
            );
          })}
          {filteredBrands.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-dim">
              <Building2 size={24} /><p className="text-xs">브랜드가 없어요</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 오른쪽: 상세 ── */}
      <div className="flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-dim">
            <Building2 size={40} /><p className="text-sm">왼쪽에서 브랜드를 선택해주세요</p>
          </div>
        ) : (
          <>
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
                  style={{ backgroundColor: selected.color + '20', border: `2px solid ${selected.color}40`, color: selected.color }}>
                  {selected.name[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary">{selected.name}</h2>
                  {selected.handle ? (
                    <p className="text-sm font-mono font-bold mt-0.5 flex items-center gap-0" style={{ color: selected.color }}>
                      <AtSign size={13} />{selected.handle}
                    </p>
                  ) : (
                    <p className="text-xs text-dim mt-0.5">@핸들 없음 — 수정에서 추가해주세요</p>
                  )}
                  <p className="text-xs text-muted mt-0.5">{selected.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selected.handle && (
                  <button onClick={() => setAddModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#FF6F0F]/10 border border-[#FF6F0F]/30 text-[#FF6F0F] rounded-xl hover:bg-[#FF6F0F]/20 transition">
                    <Plus size={12} /> 곡 추가
                  </button>
                )}
                <button onClick={() => openEdit(selected)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-fill-subtle border border-border-subtle text-tertiary rounded-xl hover:text-primary transition">
                  <Pencil size={12} /> 수정
                </button>
                <button onClick={() => handleDelete(selected)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:text-red-300 transition">
                  <Trash2 size={12} /> 삭제
                </button>
              </div>
            </div>

            {/* 스타일 태그 */}
            {selected.tags.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted mb-2 flex items-center gap-1.5"><Tag size={11} /> 스타일 태그</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                      style={{ backgroundColor: selected.color + '15', borderColor: selected.color + '40', color: selected.color }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 트랙 섹션 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <Link2 size={11} /> @{selected.handle || '핸들'} 연결 트랙 · {brandTracks.length}개
              </p>
              {brandTracks.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={selTrackIds.size === brandTracks.length ? deselectAll : selectAll}
                    className="flex items-center gap-1 text-[10px] text-muted hover:text-primary transition">
                    {selTrackIds.size === brandTracks.length
                      ? <><CheckSquare size={11} /> 전체 해제</>
                      : <><Square size={11} /> 전체 선택</>}
                  </button>
                  {selTrackIds.size > 0 && (
                    <button onClick={() => setPlaylistModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold bg-[#FF6F0F] text-primary rounded-lg hover:bg-[#FF6F0F]/90 transition">
                      <ListPlus size={11} /> 플레이리스트 만들기 ({selTrackIds.size})
                    </button>
                  )}
                  <button
                    onClick={() => { if (brandTracks.length) player.play(toPlayable(brandTracks[0]), brandTracks.map(toPlayable)); }}
                    className="flex items-center gap-1 text-[10px] text-muted hover:text-[#FF6F0F] transition">
                    <Play size={11} /> 전체 재생
                  </button>
                </div>
              )}
            </div>

            {/* 트랙 그리드 */}
            {!selected.handle ? (
              <div className="flex flex-col items-center justify-center h-24 text-dim gap-2">
                <AtSign size={24} /><p className="text-xs">@핸들을 먼저 설정해주세요</p>
              </div>
            ) : loading ? (
              <div className="text-xs text-dim">로딩 중...</div>
            ) : brandTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-dim gap-2">
                <Music size={24} /><p className="text-xs">연결된 트랙이 없어요</p>
                <p className="text-[10px] text-gray-700">"곡 추가" 버튼으로 연결하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {brandTracks.map(track => {
                  const isPlaying = player.track?.id === track.id && player.isPlaying;
                  const isActive  = player.track?.id === track.id;
                  const isSel     = selTrackIds.has(track.id);
                  const dur       = fmtDur(track.duration_sec);
                  const visibleTags = (track.mood_tags ?? []).filter(t => !t.startsWith('@')).slice(0, 2);
                  const isDragOver = dragOverBrandTrack === track.id;
                  return (
                    <div key={track.id}
                      draggable
                      onDragStart={() => handleBrandTrackDragStart(track.id)}
                      onDragOver={e => handleBrandTrackDragOver(e, track.id)}
                      onDrop={() => handleBrandTrackDrop(track.id)}
                      onDragEnd={() => setDragOverBrandTrack(null)}
                      className={`rounded-xl transition-all ${isDragOver ? 'ring-1 ring-[#FF6F0F]/50 scale-[1.02]' : ''}`}>
                    <div
                      className={`group relative flex flex-col rounded-xl overflow-hidden border transition ${
                        isSel ? 'bg-[#FF6F0F]/10 border-[#FF6F0F]/40'
                              : 'bg-white/[0.03] border-border-main hover:bg-white/[0.06] hover:border-border-subtle'
                      } ${!track.is_active ? 'opacity-50' : ''}`}>

                      {/* 체크박스 */}
                      <button onClick={() => toggleSel(track.id)}
                        className="absolute top-1.5 left-1.5 z-10 transition"
                        style={{ opacity: isSel ? 1 : undefined }}>
                        {isSel
                          ? <CheckSquare size={14} className="text-[#FF6F0F] drop-shadow opacity-100" />
                          : <Square      size={14} className="text-primary/70 drop-shadow opacity-0 group-hover:opacity-100" />}
                      </button>

                      {/* 커버 */}
                      <div className="relative aspect-square bg-fill-subtle">
                        {track.cover_image_url
                          ? <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-4xl">{track.cover_emoji}</div>}
                        {dur && (
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-primary/90 leading-none">
                            {dur}
                          </span>
                        )}
                        {/* 재생 오버레이 */}
                        <button onClick={() => togglePlay(track)} disabled={!track.audio_url}
                          className={`absolute inset-0 flex items-center justify-center transition ${
                            isActive ? 'bg-black/20' : 'bg-black/0 group-hover:bg-black/40'
                          } disabled:cursor-not-allowed`}>
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition ${
                            isActive ? 'bg-[#FF6F0F] opacity-100' : 'bg-white opacity-0 group-hover:opacity-100'
                          }`}>
                            {isPlaying
                              ? <Pause size={14} className={isActive ? 'text-primary' : 'text-[#0D0F14]'} />
                              : <Play  size={14} className={isActive ? 'text-primary' : 'text-[#0D0F14] ml-0.5'} />}
                          </span>
                        </button>
                        {/* 연결 해제 */}
                        <button onClick={() => removeTrackFromBrand(track)} title="브랜드 연결 해제"
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition">
                          <Link2Off size={9} className="text-primary" />
                        </button>
                      </div>

                      {/* 정보 */}
                      <div className="p-2">
                        <div className="flex items-center gap-1 mb-0.5">
                          <GripVertical size={10} className="text-gray-700 shrink-0 cursor-grab active:cursor-grabbing" />
                          <p className="text-primary text-xs font-semibold truncate">{track.title}</p>
                        </div>
                        <p className="text-muted text-[10px] truncate">{track.artist}</p>
                        {/* 무드태그 */}
                        {visibleTags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {visibleTags.map(tag => (
                              <span key={tag} className="text-[8px] px-1 py-0.5 bg-fill-subtle border border-border-subtle text-muted rounded leading-none">{tag}</span>
                            ))}
                          </div>
                        )}
                        <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded mt-1 inline-block"
                          style={{ backgroundColor: selected.color + '20', color: selected.color }}>
                          @{selected.handle}
                        </span>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 브랜드 등록/편집 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#13161D] border border-border-subtle rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-main shrink-0">
              <h2 className="text-base font-bold text-primary">{editId ? '✏️ 브랜드 수정' : '➕ 새 브랜드 등록'}</h2>
              <button onClick={() => setModal(false)} className="text-muted hover:text-primary transition"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
              <div>
                <label className="text-xs text-muted font-semibold block mb-1.5">브랜드명 *</label>
                <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="해쉬커피"
                  className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600" />
              </div>
              <div>
                <label className="text-xs text-muted font-semibold block mb-1.5">
                  @핸들 <span className="text-gray-700 font-normal">— 곡 · 플레이리스트 연결에 사용</span>
                </label>
                <div className="flex items-center bg-[#1F2937] border border-border-subtle rounded-xl overflow-hidden">
                  <span className="px-3 text-[#FF6F0F] font-mono font-bold text-sm select-none">@</span>
                  <input value={form.handle} onChange={e => setF('handle', normalizeHandle(e.target.value))} placeholder="hashcoffee"
                    className="flex-1 bg-transparent text-primary text-sm py-2.5 pr-3 outline-none placeholder-gray-600 font-mono" />
                </div>
                <p className="text-[10px] text-gray-700 mt-1">영문 소문자, 숫자, _ 만 사용 · 최대 30자</p>
              </div>
              <div>
                <label className="text-xs text-muted font-semibold block mb-1.5">설명</label>
                <input value={form.description} onChange={e => setF('description', e.target.value)} placeholder="스페셜티 커피 브랜드"
                  className="w-full bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2.5 border border-border-subtle outline-none placeholder-gray-600" />
              </div>
              <div>
                <label className="text-xs text-muted font-semibold block mb-2">브랜드 컬러</label>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl border-2 border-border-main shrink-0" style={{ backgroundColor: form.color }} />
                  <div className="flex flex-wrap gap-1.5">
                    {BRAND_COLORS.map(c => (
                      <button key={c} onClick={() => setF('color', c)}
                        className={`w-6 h-6 rounded-lg transition ${form.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#13161D]' : ''}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted font-semibold block mb-2">스타일 태그</label>
                <div className="flex gap-2 mb-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="태그 입력 후 엔터 (예: cozy, jazz)"
                    className="flex-1 bg-[#1F2937] text-primary text-sm rounded-xl px-3 py-2 border border-border-subtle outline-none placeholder-gray-600" />
                  <button onClick={addTag}
                    className="px-3 py-2 bg-[#FF6F0F]/15 border border-[#FF6F0F]/40 text-[#FF6F0F] rounded-xl text-xs font-semibold hover:bg-[#FF6F0F]/25 transition">
                    추가
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.tags.map(tag => (
                      <div key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FF6F0F]/10 border border-[#FF6F0F]/30 text-[#FF6F0F]">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition ml-0.5"><X size={9} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted font-semibold block mb-2">상태</label>
                <button onClick={() => setF('is_active', !form.is_active)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${
                    form.is_active ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-fill-subtle border-border-subtle text-muted'
                  }`}>
                  {form.is_active ? <Check size={14} /> : <X size={14} />}
                  {form.is_active ? '활성화' : '비활성'}
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border-main shrink-0">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 bg-fill-subtle border border-border-subtle text-tertiary text-sm font-semibold rounded-xl hover:text-primary transition">
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-[#FF6F0F] text-primary text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
                <Check size={14} /> {editId ? '수정 완료' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 곡 추가 모달 ── */}
      {addModal && selected?.handle && (
        <AddTrackModal brand={selected} tracks={tracks}
          onAdd={addTrackToBrand} onRemove={removeTrackFromBrand} onClose={() => setAddModal(false)} />
      )}

      {/* ── 플레이리스트 만들기 모달 ── */}
      {playlistModal && selected && (
        <CreatePlaylistModal
          tracks={selectedTracks} brandName={selected.name}
          onClose={() => setPlaylistModal(false)}
          onDone={() => { setPlaylistModal(false); setSelTrackIds(new Set()); alert('플레이리스트가 생성되었습니다!'); }}
        />
      )}
    </div>
  );
}
