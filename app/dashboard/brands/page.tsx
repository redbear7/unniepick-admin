'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, Plus, Pencil, Trash2, X, Check, Tag, Music, Building2 } from 'lucide-react';

// ─── 브랜드 타입 ──────────────────────────────────────────────
interface Brand {
  id:          string;
  name:        string;
  color:       string;
  description: string;
  tags:        string[];   // 이 브랜드에 해당하는 스타일 태그들
  is_active:   boolean;
  created_at:  string;
}

interface MusicTrack {
  id:        string;
  title:     string;
  artist:    string;
  mood_tags: string[];
  cover_image_url: string | null;
  cover_emoji: string;
  is_active: boolean;
}

// ─── 기본 브랜드 샘플 (localStorage 없을 때) ────────────────
const DEFAULT_BRANDS: Omit<Brand, 'id' | 'created_at'>[] = [
  {
    name:        '해쉬커피',
    color:       '#6F4E37',
    description: '스페셜티 커피 브랜드',
    tags:        ['cozy', 'lo-fi', 'acoustic', 'morning-coffee', 'warm', 'chill'],
    is_active:   true,
  },
  {
    name:        '스타벅스',
    color:       '#00704A',
    description: '글로벌 커피 브랜드',
    tags:        ['jazz', 'acoustic', 'lounge', 'ambient', 'chill', 'bright'],
    is_active:   true,
  },
  {
    name:        '더로드101',
    color:       '#1A1A2E',
    description: '프리미엄 바 & 라운지',
    tags:        ['jazz', 'r&b', 'lounge', 'night', 'ambient', 'indie'],
    is_active:   true,
  },
  {
    name:        '이마트',
    color:       '#FFD700',
    description: '대형 마트 & 리테일',
    tags:        ['upbeat', 'bright', 'pop', 'k-pop', 'energetic', 'fresh'],
    is_active:   true,
  },
];

const LS_BRANDS = 'dashboard_brands';

function loadBrands(): Brand[] {
  try {
    const saved = localStorage.getItem(LS_BRANDS);
    if (saved) return JSON.parse(saved);
  } catch {}
  // 기본 브랜드 생성
  const defaults: Brand[] = DEFAULT_BRANDS.map((b, i) => ({
    ...b,
    id:         `brand_${i + 1}`,
    created_at: new Date().toISOString(),
  }));
  localStorage.setItem(LS_BRANDS, JSON.stringify(defaults));
  return defaults;
}

const BRAND_COLORS = [
  '#FF6F0F','#6F4E37','#00704A','#1A1A2E','#FFD700','#E91E63','#9C27B0',
  '#3F51B5','#009688','#F44336','#FF9800','#607D8B','#795548','#4CAF50',
];

const EMPTY_FORM = {
  name:        '',
  color:       '#FF6F0F',
  description: '',
  tags:        [] as string[],
  is_active:   true,
};

export default function BrandsPage() {
  const sb = createClient();

  const [brands,  setBrands]  = useState<Brand[]>([]);
  const [tracks,  setTracks]  = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState('');
  const [selected, setSelected] = useState<Brand | null>(null);

  // 모달
  const [modal,  setModal]  = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');

  // 브랜드 로드 (localStorage)
  useEffect(() => {
    setBrands(loadBrands());
  }, []);

  // 트랙 로드 (Supabase)
  useEffect(() => {
    const load = async () => {
      const { data } = await sb
        .from('music_tracks')
        .select('id, title, artist, mood_tags, cover_image_url, cover_emoji, is_active')
        .order('created_at', { ascending: false });
      setTracks((data ?? []) as MusicTrack[]);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveBrands = (next: Brand[]) => {
    setBrands(next);
    localStorage.setItem(LS_BRANDS, JSON.stringify(next));
  };

  // 선택된 브랜드에 해당하는 트랙
  const brandTracks = useMemo(() => {
    if (!selected) return [];
    return tracks.filter(t =>
      (t.mood_tags ?? []).some(tag => selected.tags.includes(tag))
    );
  }, [selected, tracks]);

  const filtered = brands.filter(b =>
    !query || b.name.toLowerCase().includes(query.toLowerCase()) ||
    b.description.toLowerCase().includes(query.toLowerCase())
  );

  const setF = (key: keyof typeof EMPTY_FORM, val: any) =>
    setForm(f => ({ ...f, [key]: val }));

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setTagInput('');
    setModal(true);
  };

  const openEdit = (b: Brand) => {
    setEditId(b.id);
    setForm({
      name:        b.name,
      color:       b.color,
      description: b.description,
      tags:        [...b.tags],
      is_active:   b.is_active,
    });
    setTagInput('');
    setModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { alert('브랜드명을 입력해주세요'); return; }
    setSaving(true);
    if (editId) {
      saveBrands(brands.map(b =>
        b.id === editId ? { ...b, ...form, name: form.name.trim() } : b
      ));
    } else {
      const newBrand: Brand = {
        id:         `brand_${Date.now()}`,
        ...form,
        name:       form.name.trim(),
        created_at: new Date().toISOString(),
      };
      saveBrands([...brands, newBrand]);
    }
    setSaving(false);
    setModal(false);
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

  const removeTag = (tag: string) =>
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));

  return (
    <div className="flex h-full">
      {/* ── 왼쪽: 브랜드 목록 ── */}
      <div className="w-72 shrink-0 border-r border-white/5 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 size={16} className="text-[#FF6F0F]" /> 브랜드관
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">브랜드별 태그 · 트랙 관리</p>
          </div>
          <button onClick={openCreate}
            className="w-8 h-8 flex items-center justify-center bg-[#FF6F0F] text-white rounded-xl hover:bg-[#FF6F0F]/90 transition">
            <Plus size={14} />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-3 py-2.5 border-b border-white/5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="브랜드 검색..."
              className="w-full pl-8 pr-3 py-2 bg-[#1A1D23] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 outline-none" />
          </div>
        </div>

        {/* 브랜드 목록 */}
        <div className="flex-1 overflow-auto py-2">
          {filtered.map(b => {
            const matchCount = tracks.filter(t =>
              (t.mood_tags ?? []).some(tag => b.tags.includes(tag))
            ).length;
            const isSelected = selected?.id === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelected(isSelected ? null : b)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                  isSelected
                    ? 'bg-[#FF6F0F]/10 border-l-2 border-[#FF6F0F]'
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                } ${!b.is_active ? 'opacity-50' : ''}`}>
                {/* 컬러 닷 */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: b.color + '30', border: `2px solid ${b.color}50` }}>
                  <span className="text-base font-black" style={{ color: b.color }}>
                    {b.name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{b.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{b.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gray-400">{matchCount}</p>
                  <p className="text-[9px] text-gray-600">트랙</p>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-600">
              <Building2 size={24} />
              <p className="text-xs">브랜드가 없어요</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 오른쪽: 상세 / 트랙 목록 ── */}
      <div className="flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
            <Building2 size={40} />
            <p className="text-sm">왼쪽에서 브랜드를 선택해주세요</p>
          </div>
        ) : (
          <>
            {/* 브랜드 헤더 */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
                  style={{ backgroundColor: selected.color + '20', border: `2px solid ${selected.color}40`, color: selected.color }}>
                  {selected.name[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  <p className="text-sm text-gray-500">{selected.description}</p>
                  <p className="text-xs text-gray-600 mt-1">매칭 트랙 {brandTracks.length}개</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selected)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:text-white transition">
                  <Pencil size={12} /> 수정
                </button>
                <button onClick={() => handleDelete(selected)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:text-red-300 transition">
                  <Trash2 size={12} /> 삭제
                </button>
              </div>
            </div>

            {/* 태그 목록 */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                <Tag size={11} /> 브랜드 태그
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selected.tags.map(tag => (
                  <span key={tag}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                    style={{ backgroundColor: selected.color + '15', borderColor: selected.color + '40', color: selected.color }}>
                    {tag}
                  </span>
                ))}
                {selected.tags.length === 0 && (
                  <span className="text-xs text-gray-600">태그 없음 — 수정에서 추가해주세요</span>
                )}
              </div>
            </div>

            {/* 매칭 트랙 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                <Music size={11} /> 매칭 트랙 · {brandTracks.length}개
              </p>
              {loading ? (
                <div className="text-xs text-gray-600">로딩 중...</div>
              ) : brandTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-gray-600 gap-2">
                  <Music size={24} />
                  <p className="text-xs">매칭 트랙이 없어요</p>
                  <p className="text-[10px] text-gray-700">트랙의 mood_tags가 브랜드 태그와 일치해야 표시됩니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {brandTracks.map(track => (
                    <div key={track.id}
                      className={`flex flex-col rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 ${
                        !track.is_active ? 'opacity-50' : ''
                      }`}>
                      <div className="aspect-square bg-white/5 flex items-center justify-center">
                        {track.cover_image_url ? (
                          <img src={track.cover_image_url} alt={track.title}
                            className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl">{track.cover_emoji}</span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-white text-xs font-semibold truncate">{track.title}</p>
                        <p className="text-gray-500 text-[10px] truncate">{track.artist}</p>
                        {/* 매칭 태그 표시 */}
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {(track.mood_tags ?? [])
                            .filter(t => selected.tags.includes(t))
                            .slice(0, 2)
                            .map(t => (
                              <span key={t} className="text-[8px] px-1 py-0.5 rounded leading-none font-semibold"
                                style={{ backgroundColor: selected.color + '20', color: selected.color }}>
                                {t}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 브랜드 등록/편집 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#13161D] border border-white/10 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
              <h2 className="text-base font-bold text-white">
                {editId ? '✏️ 브랜드 수정' : '➕ 새 브랜드 등록'}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {/* 폼 */}
            <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
              {/* 브랜드명 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1.5">브랜드명 *</label>
                <input value={form.name} onChange={e => setF('name', e.target.value)}
                  placeholder="해쉬커피"
                  className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600" />
              </div>

              {/* 설명 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1.5">설명</label>
                <input value={form.description} onChange={e => setF('description', e.target.value)}
                  placeholder="스페셜티 커피 브랜드"
                  className="w-full bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 outline-none placeholder-gray-600" />
              </div>

              {/* 컬러 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-2">브랜드 컬러</label>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl border-2 border-white/20 shrink-0"
                    style={{ backgroundColor: form.color }} />
                  <div className="flex flex-wrap gap-1.5">
                    {BRAND_COLORS.map(c => (
                      <button key={c} onClick={() => setF('color', c)}
                        className={`w-6 h-6 rounded-lg transition ${
                          form.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#13161D]' : ''
                        }`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* 태그 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-2">스타일 태그</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="태그 입력 후 엔터 (예: cozy, jazz)"
                    className="flex-1 bg-[#1F2937] text-white text-sm rounded-xl px-3 py-2 border border-white/10 outline-none placeholder-gray-600" />
                  <button onClick={addTag}
                    className="px-3 py-2 bg-[#FF6F0F]/15 border border-[#FF6F0F]/40 text-[#FF6F0F] rounded-xl text-xs font-semibold hover:bg-[#FF6F0F]/25 transition">
                    추가
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.tags.map(tag => (
                      <div key={tag}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FF6F0F]/10 border border-[#FF6F0F]/30 text-[#FF6F0F]">
                        {tag}
                        <button onClick={() => removeTag(tag)}
                          className="hover:text-red-400 transition ml-0.5">
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 상태 */}
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-2">상태</label>
                <button onClick={() => setF('is_active', !form.is_active)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${
                    form.is_active
                      ? 'bg-green-500/15 border-green-500/30 text-green-400'
                      : 'bg-white/5 border-white/10 text-gray-500'
                  }`}>
                  {form.is_active ? <Check size={14} /> : <X size={14} />}
                  {form.is_active ? '활성화' : '비활성'}
                </button>
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex gap-3 px-6 py-4 border-t border-white/5 shrink-0">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-400 text-sm font-semibold rounded-xl hover:text-white transition">
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl hover:bg-[#FF6F0F]/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
                <Check size={14} /> {editId ? '수정 완료' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
