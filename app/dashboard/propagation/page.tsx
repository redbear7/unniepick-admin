'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { RefreshCw, Zap, TrendingUp } from 'lucide-react';

interface StoreStat {
  store_id:       string;
  store_name:     string;
  liked_count:    number;
  top_tags:       string[];
  avg_energy:     number;
  avg_valence:    number;
  propagated_to:  number;
  store_category: string | null;
  updated_at:     string;
}

interface PropHistory {
  id:           string;
  from_store:   { name: string } | null;
  to_store:     { name: string } | null;
  similarity:   number;
  track_ids:    string[];
  propagated_at: string;
}

function MoodDot({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-gray-500 w-6 text-right">{Math.round(value * 100)}</span>
    </div>
  );
}

export default function PropagationPage() {
  const [stats,     setStats]     = useState<StoreStat[]>([]);
  const [history,   setHistory]   = useState<PropHistory[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [rebuilding,setRebuilding]= useState(false);

  const load = async () => {
    setLoading(true);
    const sb = createClient();

    const [profilesRes, historyRes] = await Promise.all([
      sb.from('store_music_profiles')
        .select('store_id, liked_count, top_tags, avg_embedding, propagated_to, store_category, updated_at, stores(name)')
        .order('liked_count', { ascending: false })
        .limit(100),
      sb.from('propagation_history')
        .select(`
          id, similarity, propagated_at, track_ids,
          from_store:stores!propagation_history_from_store_id_fkey(name),
          to_store:stores!propagation_history_to_store_id_fkey(name)
        `)
        .order('propagated_at', { ascending: false })
        .limit(30),
    ]);

    setStats(((profilesRes.data ?? []) as any[]).map(r => ({
      store_id:       r.store_id,
      store_name:     (r.stores as any)?.name ?? '알 수 없음',
      liked_count:    r.liked_count,
      top_tags:       r.top_tags ?? [],
      avg_energy:     r.avg_embedding?.[0] ?? 0,
      avg_valence:    r.avg_embedding?.[1] ?? 0,
      propagated_to:  r.propagated_to ?? 0,
      store_category: r.store_category,
      updated_at:     r.updated_at,
    })));

    setHistory((historyRes.data ?? []) as any[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRebuild = async () => {
    setRebuilding(true);
    const sb = createClient();
    await sb.rpc('rebuild_all_store_profiles');
    await load();
    setRebuilding(false);
  };

  const totalLiked     = stats.reduce((a, s) => a + s.liked_count, 0);
  const totalPropagated = history.length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">학습 & 전파 엔진</h1>
          <p className="text-sm text-gray-500 mt-1">
            전체 {stats.length}개 매장 · 누적 좋아요 {totalLiked}곡 · 전파 이력 {totalPropagated}건
          </p>
        </div>
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6F0F]/15 text-[#FF6F0F] rounded-xl text-sm font-semibold hover:bg-[#FF6F0F]/25 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={rebuilding ? 'animate-spin' : ''} />
          {rebuilding ? '재계산 중...' : '전체 재계산'}
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: '🧬', label: '프로필 보유 매장', value: `${stats.length}개`, color: '#FF6F0F' },
          { icon: '❤️', label: '총 좋아요 트랙',   value: `${totalLiked}곡`, color: '#22C55E' },
          { icon: '⚡', label: '전파 이력',         value: `${totalPropagated}건`, color: '#818CF8' },
        ].map(card => (
          <div key={card.label} className="bg-[#1A1D23] border border-white/5 rounded-2xl p-5">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 매장 프로필 목록 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <TrendingUp size={14} /> 매장 음악 DNA 프로필
          </h2>
          <div className="space-y-3">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#1A1D23] rounded-2xl h-32 animate-pulse" />
              ))
            ) : stats.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                아직 좋아요한 트랙이 없어요
              </div>
            ) : (
              stats.map(s => (
                <div key={s.store_id} className="bg-[#1A1D23] border border-white/5 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-white text-sm">{s.store_name}</p>
                      <p className="text-xs text-gray-500">
                        {s.store_category ?? '업종 미상'} · ❤️ {s.liked_count}곡
                      </p>
                    </div>
                    {s.propagated_to > 0 && (
                      <span className="text-xs bg-[#818CF8]/15 text-[#818CF8] px-2 py-0.5 rounded-full font-semibold">
                        ⚡ {s.propagated_to}곳 전파
                      </span>
                    )}
                  </div>

                  {/* mood bars */}
                  <div className="space-y-1 mb-2">
                    <MoodDot value={s.avg_energy}  color="#FF6F0F" />
                    <MoodDot value={s.avg_valence}  color="#22C55E" />
                  </div>

                  {/* top tags */}
                  <div className="flex flex-wrap gap-1">
                    {s.top_tags.slice(0, 5).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-[#FF6F0F]/10 text-[#FF6F0F] rounded-full text-[10px] font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 전파 이력 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Zap size={14} /> 전파 이력
          </h2>
          <div className="space-y-2">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="bg-[#1A1D23] rounded-xl h-16 animate-pulse" />
              ))
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                아직 전파 이력이 없어요
              </div>
            ) : (
              history.map(h => (
                <div key={h.id} className="bg-[#1A1D23] border border-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-white truncate max-w-[120px]">
                      {(h.from_store as any)?.name ?? '?'}
                    </span>
                    <span className="text-[#818CF8] shrink-0">→</span>
                    <span className="font-semibold text-white truncate max-w-[120px]">
                      {(h.to_store as any)?.name ?? '?'}
                    </span>
                    <span className="ml-auto text-xs text-gray-500 shrink-0">
                      유사도 {Math.round((h.similarity ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-600">
                      트랙 {h.track_ids?.length ?? 0}개 ·{' '}
                      {new Date(h.propagated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
