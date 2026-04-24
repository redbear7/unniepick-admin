'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function LandingNav() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 border-b border-border-main">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 h-16">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF6F0F] flex items-center justify-center text-sm">🍖</div>
          <span className="font-bold text-primary">언니픽</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-tertiary">
          <Link href="/#features" className="hover:text-primary transition">기능</Link>
          <Link href="/#pricing" className="hover:text-primary transition">요금제</Link>
          <Link href="/#reviews" className="hover:text-primary transition">후기</Link>
          <Link href="/apply" className="hover:text-primary transition text-[#FF6F0F] font-semibold">가게등록</Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/apply"
            className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6F0F] hover:bg-[#e66000] text-white text-sm font-bold transition"
          >
            무료로 시작 <ChevronRight size={14} />
          </Link>
          <button
            onClick={() => setMobileMenu(v => !v)}
            className="md:hidden p-2 text-tertiary hover:text-primary transition"
          >
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileMenu && (
        <div className="md:hidden border-t border-border-main px-5 py-4 space-y-3 bg-surface">
          <Link href="/#features" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-tertiary hover:text-primary">기능</Link>
          <Link href="/#pricing" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-tertiary hover:text-primary">요금제</Link>
          <Link href="/#reviews" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-tertiary hover:text-primary">후기</Link>
          <Link href="/apply" onClick={() => setMobileMenu(false)} className="block text-sm font-semibold text-[#FF6F0F] hover:text-primary">가게등록</Link>
          <Link href="/apply" className="block text-center py-3 rounded-xl bg-[#FF6F0F] text-white text-sm font-bold">
            무료로 시작하기
          </Link>
        </div>
      )}
    </nav>
  );
}
