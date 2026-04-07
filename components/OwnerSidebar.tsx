'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, KeyRound, LogOut, ChevronRight, Store,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const NAV_ITEMS = [
  { href: '/owner/dashboard',     icon: LayoutDashboard, label: '대시보드' },
  { href: '/owner/dashboard/pin', icon: KeyRound,        label: 'PIN 관리' },
];

interface Props {
  name: string;
  onLogout: () => void;
}

export default function OwnerSidebar({ name, onLogout }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-border-main flex flex-col h-full overflow-y-auto">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border-main">
        <div className="w-8 h-8 rounded-lg bg-[#FF6F0F] flex items-center justify-center text-base shrink-0">🍖</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted leading-none">언니픽</p>
          <p className="text-sm font-bold text-primary leading-tight mt-0.5 truncate">{name} 사장님</p>
        </div>
        <ThemeToggle />
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4">
        <p className="px-3 mb-1 text-[10px] font-semibold text-muted uppercase tracking-wider">메뉴</p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
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
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={12} />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 하단 */}
      <div className="px-3 py-4 border-t border-border-main">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-card hover:text-red-400 transition"
        >
          <LogOut size={16} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
