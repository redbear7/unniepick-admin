'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Plus, Pencil, Trash2, Music, Search, ToggleLeft, ToggleRight, X, Check } from 'lucide-react';

interface Playlist {
  id:            string;
  name:          string;
  mood_tags:     string[];
  time_tags:     string[];
  weather_tags:  string[];
  category_tags: string[];
  is_curated:    boolean;
  is_dynamic:    boolean;
  is_active:     boolean;
  created_at:    string;
  track_count?:  number;
}

interface Track {
  id:         string;
  title:      string;
  artist:     string;
  mood_tags:  string[];
  bpm:        number | null;
}

const MOOD_OPTIONS     = ['신나는', '잔잔한', '감성적', '활기찬', '차분한', '몽환적', '로맨틱', '힙한'];
const TIME_OPTIONS     = ['morning', 'afternoon', 'evening', 'night'];
const WEATHER_OPTIONS  = ['sunny', 'cloudy', 'rainy', 'snowy', 'hot'];
const CATEGORY_OPTIONS = ['카페', '레스토랑', '바', '베이커리', '패스트푸드', '한식', '일식', '양식'];

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
        active
          ? 'bg-[#FF6F0F] text-primary'
          : 'bg-fill-subtle border border-border-subtle text-tertiary hover:text-primary hover:border-border-main'
      }`}
    >
      {label}
    </button>
  );
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  // 편집/생성 모달
  const [modal,    setModal]    = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [form, setForm] = useState({
    name:          '',
    mood_tags:     [] as string[],
    time_tags:     [] as string[],
    weather_tags:  [] as string[],
    category_tags: [] as string[],
    is_curated:    true,
    is_dynamic:    false,
  });
  const [saving, setSaving] = useState(false);

  // 트랙 선택 모달
  const [trackModal,     setTrackModal]     = useState(false);
  const [allTracks,      setAllTracks]      = useState<Track[]>([]);
  const [trackQuery,     setTrackQuery]     = useState('');
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [savingTracks,   setSavingTracks]   = useState(false);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from('playlists')
      .select('id, name, mood_tags, time_tags, weather_tags, category_tags, is_curated, is_dynamic, is_active, created_at')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    // 트랙 수 집계
    const ids = data.map(p => p.id);
    const { data: ptData } = await sb
      .from('playlist_tracks')
      .select('playlist_id')
      .in('playlist_id', ids);

    const countMap: Record<string, number> = {};
    (ptData ?? []).forEach(({ playlist_id }) => {
      countMap[playlist_id] = (countMap[playlist_id] ?? 0) + 1;
    });

    setPlaylists(data.map(p => ({ ...p, track_count: countMap[p.id] ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ name: '', mood_tags: [], time_tags: [], weather_tags: [], category_tags: [], is_curated: true, is_dynamic: false });
    setModal(true);
  };

  const openEdit = (p: Playlist) => {
    setEditId(p.id);
    setForm({
      name:          p.name,
      mood_tags:     p.mood_tags ?? [],
      time_tags:     p.time_tags ?? [],
      weather_tags:  p.weather_tags ?? [],
      category_tags: p.category_tags ?? [],
      is_curated:    p.is_curated,
      is_dynamic:    p.is_dynamic,
    });
    setModal(true);
  };

  const toggleTag = (field: 'mood_tags' | 'time_tags' | 'weather_tags' | 'category_tags', val: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(val)
        ? prev[field].filter((t: string) => t !== val)
        : [...prev[field], val],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const sb = createClient();
    try {
      if (editId) {
        await sb.from('playlists').update(form).eq('id', editId);
        setPlaylists(prev => prev.map(p => p.id === editId ? { ...p, ...form } : p));
      } else {
        const { data } = await sb.from('playlists').insert({ ...form, is_active: true }).select().single();
        if (data) setPlaylists(prev => [{ ...data, track_count: 0 }, ...prev]);
      }
      setModal(false);
    } catch (e: any) {
      alert('저장 실패: ' + (e.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Playlist) => {
    setToggling(p.id);
    const sb = createClient();
    await sb.from('playlists').update({ is_active: !p.is_active }).eq('id', p.id);
    setPlaylists(prev => prev.map(pl => pl.id === p.id ? { ...pl, is_active: !pl.is_active } : pl));
    setToggling(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 플레이리스트를 삭제할까요?`)) return;
    setDeleting(id);
    const sb = createClient();
    await sb.from('playlists').delete().eq('id', id);
    setPlaylists(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  };

  const openTrackModal = async (playlistId: string) => {
    setCurrentPlaylistId(playlistId);
    const sb = createClient();
    const [{ data: tracks }, { data: assigned }] = await Promise.all([
      sb.from('music_tracks').select('id, title, artist, mood_tags, bpm').order('title'),
      sb.from('playlist_tracks').select('track_id').eq('playlist_id', playlistId),
    ]);
    setAllTracks((tracks as any) ?? []);
    setSelectedTracks((assigned ?? []).map((a: any) => a.track_id));
    setTrackQuery('');
    setTrackModal(true);
  };

  const handleSaveTracks = async () => {
    if (!currentPlaylistId) return;
    setSavingTracks(true);
    const sb = createClient();
    await sb.from('playlist_tracks').delete().eq('playlist_id', currentPlaylistId);
    if (selectedTracks.length > 0) {
      await sb.from('playlist_tracks').insert(
        selectedTracks.map((trackId, idx) => ({
          playlist_id: currentPlaylistId,
          track_id:    trackId,
          position:    idx,
        })),
      );
    }
    setPlaylists(prev => prev.map(p =>
      p.id === currentPlaylistId ? { ...p, track_count: selectedTracks.length } : p,
    ));
    setSavingTracks(false);
    setTrackModal(false);
  };

  const filteredPlaylists = playlists.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase()),
  );

  const filteredTracks = allTracks.filter(t =>
    !trackQuery || t.title.toLowerCase().includes(trackQuery.toLowerCase()) || t.artist.toLowerCase().includes(trackQuery.toLowerCase()),
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">플레이리스트 관리</h1>
          <p className="text-sm text-muted mt-1">전체 {playlists.length}개</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6F0F] hover:bg-[#e05f00] text-primary rounded-xl text-sm font-bold transition"
        >
          <Plus size={15} /> 새 플레이리스트
        </button>
      </div>

      {/* 검색 */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="플레이리스트 검색"
          className="w-full bg-card border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
        />
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-5 animate-pulse h-24" />
          ))
        ) : filteredPlaylists.length === 0 ? (
          <div className="text-center py-16 text-dim">플레이리스트가 없어요</div>
        ) : (
          filteredPlaylists.map(p => (
            <div key={p.id} className="bg-card border border-border-main rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <Music size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-primary">{p.name}</p>
                    {p.is_dynamic && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">AI 다이나믹</span>
                    )}
                    {p.is_curated && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">큐레이션</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[...p.mood_tags, ...p.time_tags, ...p.weather_tags].slice(0, 6).map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 bg-fill-subtle text-tertiary rounded-full">{t}</span>
                    ))}
                  </div>
                  <p className="text-xs text-dim mt-1.5">트랙 {p.track_count ?? 0}곡</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* 트랙 편집 */}
                  <button
                    onClick={() => openTrackModal(p.id)}
                    className="p-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 transition"
                    title="트랙 편집"
                  >
                    <Music size={14} />
                  </button>
                  {/* 편집 */}
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 rounded-lg bg-fill-subtle hover:bg-fill-medium text-tertiary hover:text-primary transition"
                  >
                    <Pencil size={14} />
                  </button>
                  {/* 활성 토글 */}
                  <button
                    onClick={() => handleToggleActive(p)}
                    disabled={toggling === p.id}
                    className={`p-2 rounded-lg transition disabled:opacity-50 ${
                      p.is_active ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    {p.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  {/* 삭제 */}
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 편집/생성 모달 ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border-subtle rounded-2xl p-6 w-full max-w-lg my-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-primary">{editId ? '플레이리스트 편집' : '새 플레이리스트'}</h3>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-fill-medium text-muted transition">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 이름 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-1.5">플레이리스트 이름 *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예) 주말 오후 카페"
                  className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                />
              </div>

              {/* 타입 */}
              <div>
                <label className="text-xs font-semibold text-tertiary block mb-2">타입</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, is_curated: !f.is_curated }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.is_curated ? 'bg-blue-500 text-primary' : 'bg-fill-subtle text-tertiary hover:text-primary border border-border-subtle'}`}
                  >
                    큐레이션
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, is_dynamic: !f.is_dynamic }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.is_dynamic ? 'bg-purple-500 text-primary' : 'bg-fill-subtle text-tertiary hover:text-primary border border-border-subtle'}`}
                  >
                    AI 다이나믹
                  </button>
                </div>
              </div>

              {/* 무드 태그 */}
              {[
                { label: '무드 태그', field: 'mood_tags' as const, opts: MOOD_OPTIONS },
                { label: '시간대 태그', field: 'time_tags' as const, opts: TIME_OPTIONS },
                { label: '날씨 태그', field: 'weather_tags' as const, opts: WEATHER_OPTIONS },
                { label: '카테고리 태그', field: 'category_tags' as const, opts: CATEGORY_OPTIONS },
              ].map(({ label, field, opts }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-tertiary block mb-2">{label}</label>
                  <div className="flex flex-wrap gap-2">
                    {opts.map(opt => (
                      <TagChip
                        key={opt}
                        label={opt}
                        active={form[field].includes(opt)}
                        onClick={() => toggleTag(field, opt)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-tertiary bg-fill-subtle hover:bg-fill-medium transition"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#FF6F0F] hover:bg-[#e05f00] text-primary transition disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 트랙 선택 모달 ── */}
      {trackModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-border-main">
              <h3 className="text-base font-bold text-primary">트랙 선택 ({selectedTracks.length}곡)</h3>
              <button onClick={() => setTrackModal(false)} className="p-1.5 rounded-lg hover:bg-fill-medium text-muted transition">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 border-b border-border-main">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={trackQuery}
                  onChange={e => setTrackQuery(e.target.value)}
                  placeholder="곡명, 아티스트 검색"
                  className="w-full bg-surface border border-border-subtle rounded-xl pl-8 pr-4 py-2 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredTracks.map(track => {
                const checked = selectedTracks.includes(track.id);
                return (
                  <button
                    key={track.id}
                    onClick={() => setSelectedTracks(prev =>
                      checked ? prev.filter(id => id !== track.id) : [...prev, track.id],
                    )}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                      checked ? 'bg-[#FF6F0F]/10' : 'hover:bg-fill-medium'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                      checked ? 'bg-[#FF6F0F]' : 'bg-fill-medium border border-border-main'
                    }`}>
                      {checked && <Check size={12} className="text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{track.title}</p>
                      <p className="text-xs text-muted truncate">{track.artist}</p>
                    </div>
                    {track.bpm && <span className="text-xs text-dim shrink-0">{track.bpm} BPM</span>}
                  </button>
                );
              })}
              {filteredTracks.length === 0 && (
                <div className="text-center py-8 text-dim text-sm">트랙이 없어요</div>
              )}
            </div>
            <div className="p-4 border-t border-border-main">
              <button
                onClick={handleSaveTracks}
                disabled={savingTracks}
                className="w-full py-3 rounded-xl text-sm font-bold bg-[#FF6F0F] hover:bg-[#e05f00] text-primary transition disabled:opacity-50"
              >
                {savingTracks ? '저장 중...' : `${selectedTracks.length}곡 저장`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
