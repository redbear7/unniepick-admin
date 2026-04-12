'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';

const THEMES = [
  { id: 'dark',     label: 'Dark',     accent: '#FF6F0F', bg: '#1a1d24' },
  { id: 'light',    label: 'Light',    accent: '#FF6F0F', bg: '#f0f2f5' },
  { id: 'supabase', label: 'Supabase', accent: '#3ecf8e', bg: '#171717' },
  { id: 'linear',   label: 'Linear',   accent: '#7170ff', bg: '#08090a' },
  { id: 'vercel',   label: 'Vercel',   accent: '#0a72ef', bg: '#ffffff' },
  { id: 'stripe',   label: 'Stripe',   accent: '#533afd', bg: '#1c1e54' },
  { id: 'notion',   label: 'Notion',   accent: '#0075de', bg: '#f6f5f4' },
  { id: 'posthog',  label: 'PostHog',  accent: '#F54E00', bg: '#fdfdf8' },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted]   = useState(false);
  const [open, setOpen]         = useState(false);
  const ref                     = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg text-tertiary hover:bg-card hover:text-primary transition"
        title="테마 변경"
      >
        <Palette size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-xl border border-border-main bg-card shadow-xl p-2">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider px-2 pb-1.5">
            디자인 테마
          </p>
          <div className="space-y-0.5">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition ${
                  theme === t.id
                    ? 'bg-fill-medium text-primary'
                    : 'text-tertiary hover:bg-fill-subtle hover:text-primary'
                }`}
              >
                {/* swatch */}
                <span
                  className="w-5 h-5 rounded-md shrink-0 border border-border-subtle"
                  style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                />
                <span className="flex-1 text-left">{t.label}</span>
                {theme === t.id && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.accent }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
