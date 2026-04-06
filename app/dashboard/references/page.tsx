'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, Music2, ExternalLink, Trash2 } from 'lucide-react';

interface MusicReference {
  id:              string;
  store_id:        string;
  youtube_url:     string;
  youtube_id:      string | null;
  youtube_title:   string | null;
  youtube_artist:  string | null;
  youtube_channel: string | null;
  youtube_thumb:   string | null;
  extracted_tags:  {
    genre: string[]; mood: string[]; tempo: string[];
    instrument: string[]; vocal: string[]; era: string[];
  } | null;
  bpm_estimate:    number | null;
  mood_vector:     { energy: number; valence: number; danceability: number } | null;
  status:          'pending' | 'analyzing' | 'done' | 'error';
  error_msg:       string | null;
  created_at:      string;
  stores:          { name: string; category: string } | null;
}

const STATUS_MAP = {
  done:      { label: '완료',    cls: 'bg-green-500/15 text-green-400' },
  analyzing: { label: '분석 중', cls: 'bg-yellow-500/15 text-yellow-400' },
  pending:   { label: '대기',    cls: 'bg-fill-medium text-tertiary' },
  error:     { label: '오류',    cls: 'bg-red-500/15 text-red-400' },
};

function MoodBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-fill-medium rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FF6F0F] rounded-full transition-all"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-muted w-7 text-right">{Math.round(value * 100)}</span>
    </div>
  );
}

export default function ReferencesPage() {
  const [refs,    setRefs]    = useState<MusicReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState('');

  const load = async () => {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb
      .from('music_references')
      .select(`
        id, store_id, youtube_url, youtube_id, youtube_title, youtube_artist,
        youtube_channel, youtube_thumb, extracted_tags, bpm_estimate, mood_vector,
        status, error_msg, created_at,
        stores ( name, category )
      `)
      .order('created_at', { ascending: false });
    setRefs((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const sb = createClient();
    load();
    const channel = sb
      .channel('references-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_references' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 레퍼런스를 삭제할까요?')) return;
    const sb = createClient();
    await sb.from('music_references').delete().eq('id', id);
    setRefs(prev => prev.filter(r => r.id !== id));
  };

  const filtered = refs.filter(r => {
    const name = r.stores?.name ?? '';
    return !query
      || name.includes(query)
      || (r.youtube_title ?? '').includes(query)
      || (r.youtube_artist ?? '').includes(query);
  });

  const doneCount  = refs.filter(r => r.status === 'done').length;
  const errorCount = refs.filter(r => r.status === 'error').length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">레퍼런스 음악</h1>
        <p className="text-sm text-muted mt-1">
          전체 {refs.length}개 · 분석 완료 {doneCount}개
          {errorCount > 0 && <span className="text-red-400 ml-2">· 오류 {errorCount}개</span>}
        </p>
      </div>

      {/* 검색 */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="매장명, 곡 제목, 아티스트 검색"
          className="w-full bg-card border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-primary placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
        />
      </div>

      {/* 카드 목록 */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl p-5 animate-pulse h-40" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-dim">레퍼런스가 없어요</div>
        ) : (
          filtered.map(ref => {
            const st    = STATUS_MAP[ref.status] ?? STATUS_MAP.pending;
            const allTags = ref.extracted_tags
              ? [...ref.extracted_tags.genre, ...ref.extracted_tags.mood, ...ref.extracted_tags.tempo].slice(0, 8)
              : [];

            return (
              <div key={ref.id} className="bg-card border border-border-main rounded-2xl p-5">
                <div className="flex gap-4">
                  {/* 썸네일 */}
                  {ref.youtube_thumb ? (
                    <img
                      src={ref.youtube_thumb}
                      alt=""
                      className="w-20 h-14 object-cover rounded-xl shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-14 bg-fill-subtle rounded-xl flex items-center justify-center shrink-0">
                      <Music2 size={20} className="text-dim" />
                    </div>
                  )}

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="font-bold text-primary text-sm truncate">
                          {ref.youtube_title ?? ref.youtube_url}
                        </p>
                        {ref.youtube_artist && (
                          <p className="text-xs text-muted truncate">{ref.youtube_artist}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                        <a
                          href={ref.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted hover:text-[#FF6F0F] transition"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button
                          onClick={() => handleDelete(ref.id)}
                          className="text-dim hover:text-red-400 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* 매장명 */}
                    <p className="text-xs text-[#FF6F0F] mb-2">
                      🏪 {ref.stores?.name ?? '알 수 없음'} · {ref.stores?.category}
                    </p>

                    {/* 태그 */}
                    {allTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {allTags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-[#FF6F0F]/10 text-[#FF6F0F] rounded-full text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                        {ref.bpm_estimate && (
                          <span className="px-2 py-0.5 bg-fill-subtle text-tertiary rounded-full text-xs">
                            ~{ref.bpm_estimate} BPM
                          </span>
                        )}
                      </div>
                    )}

                    {ref.status === 'error' && ref.error_msg && (
                      <p className="text-xs text-red-400 mt-1">⚠️ {ref.error_msg}</p>
                    )}
                  </div>
                </div>

                {/* mood_vector 바 */}
                {ref.mood_vector && (
                  <div className="mt-4 pt-3 border-t border-border-main space-y-1.5">
                    <MoodBar label="에너지"     value={ref.mood_vector.energy} />
                    <MoodBar label="밝음/어둠"  value={ref.mood_vector.valence} />
                    <MoodBar label="댄서블"     value={ref.mood_vector.danceability} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
