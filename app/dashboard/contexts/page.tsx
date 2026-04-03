'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, RefreshCw, MapPin, Thermometer, Building2 } from 'lucide-react';

interface StoreContext {
  id:               string;
  store_id:         string;
  location_lat:     number | null;
  location_lng:     number | null;
  weather_zone:     string | null;
  weather_temp:     number | null;
  district_type:    string | null;
  district_detail:  string | null;
  nearby_counts:    Record<string, number> | null;
  menu_tags:        string[] | null;
  interior_tags:    string[] | null;
  interior_style:   string | null;
  energy_level:     number | null;
  interior_analyzed:boolean;
  updated_at:       string;
  stores:           { name: string; category: string } | null;
}

const WEATHER_LABEL: Record<string, { label: string; color: string }> = {
  'hot-humid':   { label: '☀️ 더움',  color: 'bg-orange-500/15 text-orange-400' },
  'cold-dry':    { label: '🧊 추움',  color: 'bg-blue-500/15 text-blue-400' },
  'mild-spring': { label: '🌸 쾌적',  color: 'bg-green-500/15 text-green-400' },
  'rainy':       { label: '🌧 비',    color: 'bg-sky-500/15 text-sky-400' },
  'snowy':       { label: '❄️ 눈',    color: 'bg-purple-500/15 text-purple-400' },
};

const DISTRICT_COLOR: Record<string, string> = {
  '번화가':   'bg-yellow-500/15 text-yellow-400',
  '오피스':   'bg-blue-500/15 text-blue-400',
  '학교상권': 'bg-green-500/15 text-green-400',
  '상업지구': 'bg-[#FF6F0F]/15 text-[#FF6F0F]',
  '골목상권': 'bg-pink-500/15 text-pink-400',
  '주거지':   'bg-teal-500/15 text-teal-400',
};

export default function ContextsPage() {
  const [contexts, setContexts] = useState<StoreContext[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');

  const load = async () => {
    setLoading(true);
    const sb = createClient();
    const { data } = await sb
      .from('store_contexts')
      .select(`
        id, store_id, location_lat, location_lng,
        weather_zone, weather_temp, district_type, district_detail,
        nearby_counts, menu_tags, interior_tags, interior_style,
        energy_level, interior_analyzed, updated_at,
        stores ( name, category )
      `)
      .order('updated_at', { ascending: false });
    setContexts((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const sb = createClient();
    load();
    const channel = sb
      .channel('contexts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_contexts' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = contexts.filter(c => {
    const name = c.stores?.name ?? '';
    return !query || name.includes(query) || (c.district_detail ?? '').includes(query);
  });

  const analyzedCount  = contexts.filter(c => c.interior_analyzed).length;
  const districtCounts = contexts.reduce<Record<string, number>>((acc, c) => {
    const d = c.district_type ?? '미수집';
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">매장 컨텍스트</h1>
        <p className="text-sm text-gray-500 mt-1">
          전체 {contexts.length}개 · 인테리어 분석 완료 {analyzedCount}개
        </p>
      </div>

      {/* 상권 분포 요약 */}
      <div className="flex gap-2 flex-wrap mb-6">
        {Object.entries(districtCounts).map(([type, count]) => (
          <div
            key={type}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${DISTRICT_COLOR[type] ?? 'bg-white/5 text-gray-400'}`}
          >
            <Building2 size={11} />
            {type} {count}
          </div>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="매장명, 지역 검색"
          className="w-full bg-[#1A1D23] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
        />
      </div>

      {/* 카드 목록 */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1A1D23] rounded-2xl p-5 animate-pulse h-36" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">수집된 컨텍스트가 없어요</div>
        ) : (
          filtered.map(ctx => {
            const weather = ctx.weather_zone ? WEATHER_LABEL[ctx.weather_zone] : null;
            const districtColor = DISTRICT_COLOR[ctx.district_type ?? ''] ?? 'bg-white/5 text-gray-400';

            return (
              <div key={ctx.id} className="bg-[#1A1D23] border border-white/5 rounded-2xl p-5">
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-bold text-white text-sm">{ctx.stores?.name ?? '알 수 없음'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ctx.stores?.category ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
                    <RefreshCw size={10} />
                    {new Date(ctx.updated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* 뱃지 행 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {ctx.district_type && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${districtColor}`}>
                      {ctx.district_type}
                    </span>
                  )}
                  {weather && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${weather.color}`}>
                      {weather.label}
                      {ctx.weather_temp != null && ` ${ctx.weather_temp.toFixed(1)}°C`}
                    </span>
                  )}
                  {ctx.interior_analyzed && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400">
                      🎨 인테리어 분석됨
                    </span>
                  )}
                </div>

                {/* 지역 */}
                {ctx.district_detail && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                    <MapPin size={10} /> {ctx.district_detail}
                  </p>
                )}

                {/* 메뉴 태그 */}
                {ctx.menu_tags && ctx.menu_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-xs text-gray-600 self-center">메뉴:</span>
                    {ctx.menu_tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-[#FF6F0F]/10 text-[#FF6F0F] rounded-full text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 인테리어 태그 */}
                {ctx.interior_tags && ctx.interior_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-gray-600 self-center">인테리어:</span>
                    {ctx.interior_tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 주변 POI */}
                {ctx.nearby_counts && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex gap-4 text-xs text-gray-500">
                    {Object.entries(ctx.nearby_counts).map(([key, val]) => (
                      <span key={key}>{key} <strong className="text-gray-300">{val}</strong></span>
                    ))}
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
