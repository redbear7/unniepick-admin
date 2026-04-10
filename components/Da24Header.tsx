'use client';

import { useState } from 'react';
import { MapPin, Bell, Menu, X, ChevronDown } from 'lucide-react';
import Link from 'next/link';

export default function Da24Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border-main">
      <div className="max-w-[640px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-extrabold text-[#FF6F0F] tracking-tight">DA24</span>
          <span className="text-[10px] font-semibold text-muted ml-0.5 leading-none mt-1">이사비교</span>
        </Link>

        {/* Location */}
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-fill-subtle text-sm font-semibold text-secondary">
          <MapPin size={13} className="text-[#FF6F0F]" />
          <span>서울 전체</span>
          <ChevronDown size={12} className="text-muted" />
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="relative p-2 text-secondary hover:text-primary transition">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF6F0F]" />
          </button>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 text-secondary hover:text-primary transition"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Slide-down mobile menu */}
      {menuOpen && (
        <div className="max-w-[640px] mx-auto border-t border-border-main bg-surface px-4 py-3 space-y-1">
          {[
            { label: '가정이사', href: '/#moving-categories' },
            { label: '소형이사', href: '/#moving-categories' },
            { label: '사무실이사', href: '/#moving-categories' },
            { label: '입주청소', href: '/#extra-services' },
            { label: '인터넷 비교', href: '/internet' },
          ].map(item => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-secondary hover:text-primary transition border-b border-border-subtle last:border-0"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
