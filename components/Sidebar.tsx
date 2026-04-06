'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  LayoutDashboard, Store, FileText, Music, Ticket,
  Users, LogOut, ChevronRight, ScrollText, MapPin, PlaySquare, Zap, Map, ListMusic, Tag, Building2, Megaphone, Film,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const NAV_GROUPS = [
  {
    label: '개요',
    items: [
      { href: '/dashboard',      icon: LayoutDashboard, label: '대시보드' },
      { href: '/dashboard/map',  icon: Map,             label: '지도' },
    ],
  },
  {
    label: '매장 관리',
    items: [
      { href: '/dashboard/stores',    icon: Store,     label: '가게 관리' },
      { href: '/dashboard/contexts',  icon: MapPin,    label: '매장 컨텍스트' },
      { href: '/dashboard/brands',    icon: Building2, label: '브랜드관' },
    ],
  },
  {
    label: '음악 관리',
    items: [
      { href: '/dashboard/tracks',        icon: ListMusic,  label: '트랙 관리' },
      { href: '/dashboard/playlists',     icon: Music,      label: '플레이리스트' },
      { href: '/dashboard/references',    icon: PlaySquare, label: '레퍼런스 음악' },
      { href: '/dashboard/announcements', icon: Megaphone,  label: 'AI음성안내' },
      { href: '/dashboard/shorts',        icon: Film,       label: '쇼츠 생성' },
      { href: '/dashboard/tags',          icon: Tag,        label: '태그관리' },
    ],
  },
  {
    label: '고객 & 마케팅',
    items: [
      { href: '/dashboard/users',   icon: Users,    label: '회원 관리' },
      { href: '/dashboard/posts',   icon: FileText, label: '게시물 관리' },
      { href: '/dashboard/coupons', icon: Ticket,   label: '쿠폰 관리' },
    ],
  },
  {
    label: '시스템',
    items: [
      { href: '/dashboard/propagation', icon: Zap,        label: '학습 & 전파' },
      { href: '/dashboard/opensource',  icon: ScrollText, label: '오픈소스' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-border-main flex flex-col h-full overflow-y-auto">
      {/* 로고 */}
      <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5 border-b border-border-main hover:bg-card transition">
        <div className="w-8 h-8 rounded-lg bg-[#FF6F0F] flex items-center justify-center text-base shrink-0">🍖</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted leading-none">언니픽</p>
          <p className="text-sm font-bold text-primary leading-tight mt-0.5">슈퍼어드민</p>
          <p className="text-[10px] text-muted mt-1">v0.1.1</p>
        </div>
        <ThemeToggle />
      </Link>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</p>
            <div className="space-y-0.5">
              {items.map(({ href, icon: Icon, label: itemLabel }) => {
                const isActive = href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]'
                        : 'text-tertiary hover:bg-card hover:text-primary'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1">{itemLabel}</span>
                    {isActive && <ChevronRight size={12} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 하단 */}
      <div className="px-3 py-4 border-t border-border-main">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-card hover:text-red-400 transition"
        >
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
