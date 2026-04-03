'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Trash2, Plus, TrendingUp, Tag, Hash } from 'lucide-react';

// ─── 태그 정의 (tracks/page.tsx와 동일) ─────────────────────────────
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

const ALL_SUNO_TAGS: string[] = Object.values(SUNO_STYLE_TAGS)
  .flatMap(cat => Object.values(cat).flat());

const LS_CUSTOM_TAGS = 'suno_lib_custom_tags';
const LS_HIDDEN_TAGS = 'suno_lib_hidden_tags';
const NEW_TAG_DAYS   = 7;

interface LibTag { tag: string; addedAt: number; }
interface TagStat { tag: string; count: number; isNew: boolean; isCustom: boolean; isHidden: boolean; addedAt?: number; }

export default function TagsPage() {
  const sb = createClient();

  const [tagStats,     setTagStats]     = useState<Record<string, number>>({});
  const [customTags,   setCustomTags]   = useState<LibTag[]>([]);
  const [hiddenTags,   setHiddenTags]   = useState<Set<string>>(new Set());
  const [loading,      setLoading]      = useState(true);
  const [newTagInput,  setNewTagInput]  = useState('');
  const [adding,       setAdding]       = useState(false);

  // ── 로드 ──────────────────────────────────────────────────────
  useEffect(() => {
    const initLS = () => {
      try {
        const ct: LibTag[] = JSON.parse(localStorage.getItem(LS_CUSTOM_TAGS) || '[]');
        const ht: string[] = JSON.parse(localStorage.getItem(LS_HIDDEN_TAGS) || '[]');
        setCustomTags(ct);
        setHiddenTags(new Set(ht));
      } catch {}
    };

    const loadTagStats = async () => {
      const { data } = await sb
        .from('music_tracks')
        .select('mood_tags')
        .eq('is_active', true);

      const counts: Record<string, number> = {};
      (data || []).forEach(row => {
        (row.mood_tags as string[] || []).forEach(t => {
          counts[t] = (counts[t] || 0) + 1;
        });
      });
      setTagStats(counts);
      setLoading(false);
    };

    initLS();
    loadTagStats();
  }, []);

  const saveCustomTags = (updated: LibTag[]) => {
    setCustomTags(updated);
    localStorage.setItem(LS_CUSTOM_TAGS, JSON.stringify(updated));
  };

  const saveHiddenTags = (updated: Set<string>) => {
    setHiddenTags(updated);
    localStorage.setItem(LS_HIDDEN_TAGS, JSON.stringify([...updated]));
  };

  // ── 태그 추가 ─────────────────────────────────────────────────
  const handleAddTag = () => {
    const tag = newTagInput.trim().toLowerCase();
    if (!tag) return;
    if (customTags.some(c => c.tag === tag) || ALL_SUNO_TAGS.includes(tag)) {
      alert('이미 존재하는 태그입니다.');
      return;
    }
    setAdding(true);
    const updated = [...customTags, { tag, addedAt: Date.now() }];
    saveCustomTags(updated);
    setNewTagInput('');
    setAdding(false);
  };

  // ── 내장 태그 숨기기/복원 ──────────────────────────────────────
  const toggleHideBuiltin = (tag: string) => {
    const next = new Set(hiddenTags);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    saveHiddenTags(next);
  };

  // ── 커스텀 태그 삭제 ──────────────────────────────────────────
  const deleteCustomTag = (tag: string) => {
    saveCustomTags(customTags.filter(c => c.tag !== tag));
  };

  // ── 인기 태그 top N ───────────────────────────────────────────
  const sorted = Object.entries(tagStats)
    .sort((a, b) => b[1] - a[1])
    .filter(([, c]) => c > 0);
  const topTags = sorted.slice(0, 15);
  const maxCount = topTags[0]?.[1] || 1;

  // ── 전체 태그 수 ──────────────────────────────────────────────
  const totalBuiltin  = ALL_SUNO_TAGS.length - hiddenTags.size;
  const totalCustom   = customTags.length;
  const totalTracked  = sorted.length;

  const isNew = (addedAt?: number) =>
    !!addedAt && Date.now() - addedAt < NEW_TAG_DAYS * 86400000;

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Tag size={20} className="text-[#FF6F0F]" /> 태그관리
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">음악 태그 라이브러리를 관리합니다</p>
        </div>
      </div>

      {/* ── 통계 카드 ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '내장 태그', value: totalBuiltin, sub: `전체 ${ALL_SUNO_TAGS.length}개` },
          { label: '커스텀 태그', value: totalCustom, sub: '임포트·직접 추가' },
          { label: '사용 중 태그', value: totalTracked, sub: '1곡 이상' },
          { label: '숨김 태그', value: hiddenTags.size, sub: '내장 비활성' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs font-semibold text-gray-300 mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── 인기 태그 ── */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
          <TrendingUp size={14} className="text-[#FF6F0F]" /> 인기 태그 Top {topTags.length}
        </h2>
        {loading ? (
          <p className="text-xs text-gray-500">불러오는 중...</p>
        ) : topTags.length === 0 ? (
          <p className="text-xs text-gray-500">아직 태그가 사용된 트랙이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {topTags.map(([tag, count], i) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600 w-4 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 relative h-6 flex items-center">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md bg-[#FF6F0F]/15"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                  <span className="relative text-xs text-gray-300 px-2 truncate">{tag}</span>
                </div>
                <span className="text-xs font-semibold text-[#FF6F0F] w-8 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 커스텀 태그 섹션 ── */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5 mb-4">
          <Hash size={14} className="text-green-400" /> 📥 임포트·신규 태그
          {customTags.filter(c => isNew(c.addedAt)).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px]">
              NEW {customTags.filter(c => isNew(c.addedAt)).length}
            </span>
          )}
        </h2>

        {/* 태그 추가 입력 */}
        <div className="flex gap-2 mb-4">
          <input
            value={newTagInput}
            onChange={e => setNewTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
            placeholder="태그 직접 추가 (영문 소문자 권장)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F]/50"
          />
          <button
            onClick={handleAddTag}
            disabled={adding || !newTagInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6F0F] text-white text-sm font-semibold rounded-lg hover:bg-[#FF6F0F]/90 disabled:opacity-40 transition">
            <Plus size={14} /> 추가
          </button>
        </div>

        {customTags.length === 0 ? (
          <p className="text-xs text-gray-600">아직 커스텀 태그가 없습니다. 임포트하거나 직접 추가해보세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customTags.map(({ tag, addedAt }) => (
              <div key={tag}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 group">
                <span className="text-xs text-gray-300">{tag}</span>
                {isNew(addedAt) && (
                  <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-green-500/20 text-green-400">NEW</span>
                )}
                {tagStats[tag] > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FF6F0F]/15 text-[#FF6F0F] font-semibold">{tagStats[tag]}</span>
                )}
                <button
                  onClick={() => deleteCustomTag(tag)}
                  className="text-gray-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100 ml-0.5">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 내장 Suno 스타일 태그 ── */}
      {Object.entries(SUNO_STYLE_TAGS).map(([section, cats]) => (
        <div key={section} className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">{section}</h2>
          <div className="space-y-4">
            {Object.entries(cats).map(([catName, tags]) => (
              <div key={catName}>
                <p className="text-[11px] font-semibold text-gray-500 mb-2">{catName}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => {
                    const hidden = hiddenTags.has(tag);
                    const count  = tagStats[tag] || 0;
                    return (
                      <div key={tag}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border group transition ${
                          hidden
                            ? 'bg-white/[0.02] border-white/5 opacity-40'
                            : 'bg-white/5 border-white/10'
                        }`}>
                        <span className={`text-xs ${hidden ? 'text-gray-600' : 'text-gray-300'}`}>{tag}</span>
                        {count > 0 && !hidden && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FF6F0F]/15 text-[#FF6F0F] font-semibold">{count}</span>
                        )}
                        <button
                          onClick={() => toggleHideBuiltin(tag)}
                          title={hidden ? '복원' : '숨기기'}
                          className="text-gray-700 hover:text-gray-400 transition opacity-0 group-hover:opacity-100 ml-0.5">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
