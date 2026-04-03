'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Store, Users, Ticket, FileText, AlertCircle, Music } from 'lucide-react';

interface Stats {
  stores:        number;
  activeStores:  number;
  users:         number;
  coupons:       number;
  activeCoupons: number;
  posts:         number;
  pendingDelete: number;
  playlists:     number;
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = createClient();

    const load = async () => {
      const [
        { count: stores },
        { count: activeStores },
        { count: users },
        { count: coupons },
        { count: activeCoupons },
        { count: posts },
        { count: pendingDelete },
        { count: playlists },
      ] = await Promise.all([
        sb.from('stores').select('*', { count: 'exact', head: true }),
        sb.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('users').select('*', { count: 'exact', head: true }),
        sb.from('coupons').select('*', { count: 'exact', head: true }),
        sb.from('coupons').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('store_posts').select('*', { count: 'exact', head: true }),
        sb.from('post_delete_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        sb.from('playlists').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        stores:        stores ?? 0,
        activeStores:  activeStores ?? 0,
        users:         users ?? 0,
        coupons:       coupons ?? 0,
        activeCoupons: activeCoupons ?? 0,
        posts:         posts ?? 0,
        pendingDelete: pendingDelete ?? 0,
        playlists:     playlists ?? 0,
      });
      setLoading(false);
    };

    load();

    // 실시간 구독 — 주요 테이블 변경 시 자동 갱신
    const channel = sb
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' },               () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' },              () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_posts' },          () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_delete_requests' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },                () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' },            () => load())
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, []);

  const CARDS = stats ? [
    {
      icon: Store, label: '전체 가게', value: stats.stores,
      sub: `활성 ${stats.activeStores}개`,
      color: 'text-[#FF6F0F]', bg: 'bg-[#FF6F0F]/10',
    },
    {
      icon: Users, label: '전체 회원', value: stats.users,
      sub: '가입된 전체 사용자',
      color: 'text-blue-400', bg: 'bg-blue-400/10',
    },
    {
      icon: Ticket, label: '전체 쿠폰', value: stats.coupons,
      sub: `활성 ${stats.activeCoupons}개`,
      color: 'text-green-400', bg: 'bg-green-400/10',
    },
    {
      icon: FileText, label: '피드 게시물', value: stats.posts,
      sub: pendingDelete(stats) > 0 ? `⚠️ 삭제 요청 ${pendingDelete(stats)}건 대기 중` : '삭제 요청 없음',
      subColor: pendingDelete(stats) > 0 ? 'text-red-400' : '',
      color: 'text-purple-400', bg: 'bg-purple-400/10',
    },
    {
      icon: Music, label: '플레이리스트', value: stats.playlists,
      sub: 'AI + 수동 합계',
      color: 'text-indigo-400', bg: 'bg-indigo-400/10',
    },
  ] : [];

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#1A1D23] rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {CARDS.map(({ icon: Icon, label, value, sub, subColor, color, bg }) => (
            <div key={label} className="bg-[#1A1D23] border border-white/5 rounded-2xl p-5">
              <div className={`inline-flex p-2 rounded-xl ${bg} mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">{label}</p>
              <p className={`text-xs mt-1.5 ${subColor || 'text-gray-600'}`}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* 삭제 요청 알림 */}
      {stats && stats.pendingDelete > 0 && (
        <div className="mt-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">게시물 삭제 요청 {stats.pendingDelete}건 처리 필요</p>
            <p className="text-xs text-gray-500 mt-0.5">
              게시물 관리 메뉴에서 승인 또는 반려해주세요
            </p>
          </div>
        </div>
      )}

      {/* 빠른 링크 */}
      <div className="mt-8">
        <h2 className="text-sm font-bold text-gray-400 mb-3">빠른 이동</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/stores',    emoji: '🏪', label: '가게 승인 관리' },
            { href: '/dashboard/posts',     emoji: '📝', label: '삭제 요청 처리' },
            { href: '/dashboard/coupons',   emoji: '🎟', label: '쿠폰 현황' },
            { href: '/dashboard/playlists', emoji: '🎵', label: '플레이리스트 편집' },
          ].map(({ href, emoji, label }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 bg-[#1A1D23] hover:bg-[#22252E] border border-white/5 rounded-xl px-4 py-3.5 transition group"
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function pendingDelete(stats: Stats) { return stats.pendingDelete; }
