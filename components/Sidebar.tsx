'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  LayoutDashboard, Store, FileText, Music, Ticket,
  Users, LogOut, ChevronRight, ScrollText, MapPin, PlaySquare, Zap, Map, ListMusic, Tag,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',             icon: LayoutDashboard, label: '대시보드' },
  { href: '/dashboard/map',         icon: Map,             label: '지도' },
  { href: '/dashboard/stores',      icon: Store,           label: '가게 관리' },
  { href: '/dashboard/contexts',    icon: MapPin,          label: '매장 컨텍스트' },
  { href: '/dashboard/tracks',      icon: ListMusic,       label: '트랙 관리' },
  { href: '/dashboard/references',  icon: PlaySquare,      label: '레퍼런스 음악' },
  { href: '/dashboard/posts',       icon: FileText,        label: '게시물 관리' },
  { href: '/dashboard/coupons',     icon: Ticket,          label: '쿠폰 관리' },
  { href: '/dashboard/playlists',   icon: Music,           label: '플레이리스트' },
  { href: '/dashboard/users',       icon: Users,           label: '회원 관리' },
  { href: '/dashboard/propagation',  icon: Zap,             label: '학습 & 전파' },
  { href: '/dashboard/opensource',  icon: ScrollText,      label: '오픈소스' },
  { href: '/dashboard/tags',        icon: Tag,             label: '태그관리' },
];

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-56 shrink-0 bg-[#111318] border-r border-white/5 flex flex-col h-full overflow-y-auto">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-[#FF6F0F] flex items-center justify-center text-base">🍖</div>
        <div>
          <p className="text-sm font-bold text-white leading-none">언니픽</p>
          <p className="text-[10px] text-gray-500 mt-0.5">SUPERADMIN</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition group ${
                isActive
                  ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight size={12} />}
            </Link>
          );
        })}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-white/5 hover:text-red-400 transition"
        >
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
