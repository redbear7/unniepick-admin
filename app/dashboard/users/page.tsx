'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Search, User, Store, Shield } from 'lucide-react';

interface UserRow {
  id:         string;
  name:       string;
  phone:      string | null;
  role:       string;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  customer:   '고객',
  owner:      '사장님',
  superadmin: '시샵',
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  customer:   <User size={12} />,
  owner:      <Store size={12} />,
  superadmin: <Shield size={12} />,
};

const ROLE_COLOR: Record<string, string> = {
  customer:   'bg-blue-500/15 text-blue-400',
  owner:      'bg-[#FF6F0F]/15 text-[#FF6F0F]',
  superadmin: 'bg-purple-500/15 text-purple-400',
};

export default function UsersPage() {
  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState('');
  const [filter,  setFilter]  = useState<'all' | 'customer' | 'owner'>('all');

  useEffect(() => {
    const sb = createClient();
    const load = async () => {
      const { data } = await sb
        .from('users')
        .select('id, name, phone, role, created_at')
        .neq('role', 'superadmin')
        .order('created_at', { ascending: false });
      setUsers(data ?? []);
      setLoading(false);
    };
    load();
    const channel = sb
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  const filtered = users.filter(u => {
    const matchF = filter === 'all' || u.role === filter;
    const matchQ = !query || u.name.includes(query) || (u.phone ?? '').includes(query);
    return matchF && matchQ;
  });

  const counts = {
    all:      users.length,
    customer: users.filter(u => u.role === 'customer').length,
    owner:    users.filter(u => u.role === 'owner').length,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">회원 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          전체 {users.length}명 · 고객 {counts.customer}명 · 사장님 {counts.owner}명
        </p>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="이름, 전화번호 검색"
            className="w-full bg-[#1A1D23] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF6F0F] transition"
          />
        </div>
        {(['all', 'customer', 'owner'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              filter === f ? 'bg-[#FF6F0F] text-white' : 'bg-[#1A1D23] border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? '전체' : ROLE_LABEL[f]}
            <span className="ml-1.5 text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-[#1A1D23] border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">이름</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">전화번호</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">역할</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500">가입일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(4)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-600">회원이 없어요</td>
              </tr>
            ) : (
              filtered.map(user => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400">
                        {user.name.charAt(0)}
                      </div>
                      <p className="font-semibold text-white">{user.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-gray-400">{user.phone ?? '-'}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_COLOR[user.role] ?? 'bg-white/5 text-gray-400'}`}>
                      {ROLE_ICON[user.role]}
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
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
