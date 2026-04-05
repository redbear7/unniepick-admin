'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  LayoutDashboard, Store, FileText, Music, Ticket,
  Users, LogOut, ChevronRight, ScrollText, MapPin, PlaySquare, Zap, Map, ListMusic, Tag, GripVertical, Building2, Megaphone,
} from 'lucide-react';

const NAV_DEFAULT = [
  { href: '/dashboard',            icon: LayoutDashboard, label: '대시보드' },
  { href: '/dashboard/map',        icon: Map,             label: '지도' },
  { href: '/dashboard/stores',     icon: Store,           label: '가게 관리' },
  { href: '/dashboard/contexts',   icon: MapPin,          label: '매장 컨텍스트' },
  { href: '/dashboard/tracks',          icon: ListMusic,   label: '트랙 관리' },
  { href: '/dashboard/announcements',   icon: Megaphone,   label: 'AI음성안내' },
  { href: '/dashboard/references', icon: PlaySquare,      label: '레퍼런스 음악' },
  { href: '/dashboard/posts',      icon: FileText,        label: '게시물 관리' },
  { href: '/dashboard/coupons',    icon: Ticket,          label: '쿠폰 관리' },
  { href: '/dashboard/playlists',  icon: Music,           label: '플레이리스트' },
  { href: '/dashboard/users',      icon: Users,           label: '회원 관리' },
  { href: '/dashboard/propagation',icon: Zap,             label: '학습 & 전파' },
  { href: '/dashboard/opensource', icon: ScrollText,      label: '오픈소스' },
  { href: '/dashboard/tags',       icon: Tag,             label: '태그관리' },
  { href: '/dashboard/brands',     icon: Building2,       label: '브랜드관' },
];

const LS_NAV_ORDER = 'dashboard_nav_order';

function loadOrder(): string[] {
  const defaults = NAV_DEFAULT.map(n => n.href);
  try {
    const saved = localStorage.getItem(LS_NAV_ORDER);
    if (saved) {
      const parsed: string[] = JSON.parse(saved);
      const missing = defaults.filter(h => !parsed.includes(h));
      return [...parsed, ...missing];
    }
  } catch {}
  return defaults;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [order,     setOrder]     = useState<string[]>(() => NAV_DEFAULT.map(n => n.href));
  const [dragOver,  setDragOver]  = useState<string | null>(null);
  const dragItem = useRef<string | null>(null);

  // localStorage는 클라이언트에서만 읽음
  useEffect(() => { setOrder(loadOrder()); }, []);

  const navMap = Object.fromEntries(NAV_DEFAULT.map(n => [n.href, n]));
  const navItems = order.map(href => navMap[href]).filter(Boolean);

  const saveOrder = (next: string[]) => {
    setOrder(next);
    localStorage.setItem(LS_NAV_ORDER, JSON.stringify(next));
  };

  const handleDragStart = (href: string) => { dragItem.current = href; };

  const handleDragOver = (e: React.DragEvent, href: string) => {
    e.preventDefault();
    setDragOver(href);
  };

  const handleDrop = (targetHref: string) => {
    const from = dragItem.current;
    if (!from || from === targetHref) { setDragOver(null); return; }
    const next = [...order];
    const fi = next.indexOf(from);
    const ti = next.indexOf(targetHref);
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    saveOrder(next);
    dragItem.current = null;
    setDragOver(null);
  };

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
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href);
          return (
            <div
              key={href}
              draggable
              onDragStart={() => handleDragStart(href)}
              onDragOver={e => handleDragOver(e, href)}
              onDrop={() => handleDrop(href)}
              onDragEnd={() => setDragOver(null)}
              className={`rounded-lg transition-all ${
                dragOver === href ? 'ring-1 ring-[#FF6F0F]/50 bg-[#FF6F0F]/5' : ''
              }`}
            >
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition group ${
                  isActive
                    ? 'bg-[#FF6F0F]/15 text-[#FF6F0F]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <GripVertical
                  size={12}
                  className="shrink-0 text-gray-700 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing -ml-1 transition-opacity"
                />
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={12} />}
              </Link>
            </div>
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
