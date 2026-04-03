'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, ToggleLeft, ToggleRight, MapPin, Phone } from 'lucide-react';

interface Store {
  id:          string;
  name:        string;
  address:     string | null;
  phone:       string | null;
  category:    string | null;
  is_active:   boolean;
  created_at:  string;
  owner_id:    string | null;
  image_url:   string | null;
}

export default function StoresPage() {
  const [stores,  setStores]  = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState('');
  const [filter,  setFilter]  = useState<'all' | 'active' | 'inactive'>('all');
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    const sb = createClient();
    const { data } = await sb
      .from('stores')
      .select('id, name, address, phone, category, is_active, created_at, owner_id, image_url')
      .order('created_at', { ascending: false });
    setStores(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const sb = createClient();
    load();
    const channel = sb
      .channel('stores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (store: Store) => {
    setToggling(store.id);
    const sb = createClient();
    await sb.from('stores').update({ is_active: !store.is_active }).eq('id', store.id);
    setStores(prev => prev.map(s => s.id === store.id ? { ...s, is_active: !s.is_active } : s));
    setToggling(null);
  };

  const filtered = stores.filter(s => {
    const matchQ = !query || s.name.includes(query) || (s.address ?? '').includes(query);
    const matchF = filter === 'all' || (filter === 'active' ? s.is_active : !s.is_active);
    return matchQ && matchF;
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">가게 관리</h1>
        <p className="text-sm text-gray-500 mt-1">전체 {stores.length}개 가게 · 활성 {stores.filter(s => s.is_active).length}개</p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="가게명, 주소 검색"
            className="w-full bg-[#1A1D23] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
          />
        </div>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              filter === f ? 'bg-[#FF6F0F] text-white' : 'bg-[#1A1D23] border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? '전체' : f === 'active' ? '활성' : '비활성'}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-[#1A1D23] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">가게명</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">카테고리</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">연락처</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">등록일</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-600">가게가 없어요</td>
              </tr>
            ) : (
              filtered.map(store => (
                <tr key={store.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FF6F0F]/20 flex items-center justify-center text-sm shrink-0">
                        🏪
                      </div>
                      <div>
                        <p className="font-semibold text-white">{store.name}</p>
                        {store.address && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {store.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-2.5 py-1 bg-white/5 rounded-lg text-xs text-gray-400">
                      {store.category ?? '미분류'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {store.phone ? (
                      <p className="text-gray-300 flex items-center gap-1.5">
                        <Phone size={12} className="text-gray-500" />
                        {store.phone}
                      </p>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">
                    {new Date(store.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => toggleActive(store)}
                      disabled={toggling === store.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                      style={{
                        background: store.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.1)',
                        color:      store.is_active ? '#22C55E' : '#F87171',
                      }}
                    >
                      {store.is_active
                        ? <><ToggleRight size={14} /> 활성</>
                        : <><ToggleLeft  size={14} /> 비활성</>}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
