'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const THEMES = [
  { id: 'dark',     label: 'Dark',     accent: '#FF6F0F', bg: '#1a1d24' },
  { id: 'light',    label: 'Light',    accent: '#FF6F0F', bg: '#f0f2f5' },
  { id: 'supabase', label: 'Supabase', accent: '#3ecf8e', bg: '#171717' },
  { id: 'linear',   label: 'Linear',   accent: '#7170ff', bg: '#08090a' },
  { id: 'vercel',   label: 'Vercel',   accent: '#0a72ef', bg: '#ffffff'  },
  { id: 'stripe',   label: 'Stripe',   accent: '#533afd', bg: '#1c1e54' },
  { id: 'notion',   label: 'Notion',   accent: '#0075de', bg: '#f6f5f4' },
  { id: 'posthog',  label: 'PostHog',  accent: '#F54E00', bg: '#fdfdf8' },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-5 w-16" />;

  const idx     = THEMES.findIndex(t => t.id === theme);
  const current = THEMES[idx] ?? THEMES[0];
  const nextIdx = (idx + 1) % THEMES.length;

  const cycleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTheme(THEMES[nextIdx].id);
  };

  return (
    <button
      onClick={cycleNext}
      title={`다음 테마: ${THEMES[nextIdx].label}`}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border-subtle bg-fill-subtle hover:bg-fill-medium transition shrink-0"
    >
      {/* accent dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: current.accent }}
      />
      {/* label + index */}
      <span className="text-[10px] font-medium text-muted leading-none whitespace-nowrap">
        {current.label}
      </span>
      <span className="text-[9px] text-dim leading-none">
        {idx + 1}/{THEMES.length}
      </span>
    </button>
  );
}
