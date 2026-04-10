'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Flame, Gauge, CloudMoon, Sparkles, Gem } from 'lucide-react';

const CYCLE: Record<string, string> = {
  light:    'dark',
  dark:     'red',
  red:      'ferrari',
  ferrari:  'midnight',
  midnight: 'aurora',
  aurora:   'obsidian',
  obsidian: 'light',
};
const ICON: Record<string, React.ReactNode> = {
  light:    <Moon      size={16} />,
  dark:     <Flame     size={16} />,
  red:      <Gauge     size={16} />,
  ferrari:  <CloudMoon size={16} />,
  midnight: <Sparkles  size={16} />,
  aurora:   <Gem       size={16} />,
  obsidian: <Sun       size={16} />,
};
const ORDER = ['light', 'dark', 'red', 'ferrari', 'midnight', 'aurora', 'obsidian'];
const NAME: Record<string, string> = {
  light:    'Light',
  dark:     'Dark',
  red:      'Red',
  ferrari:  'Ferrari',
  midnight: 'Midnight',
  aurora:   'Aurora',
  obsidian: 'Obsidian',
};
const LABEL: Record<string, string> = {
  light:    '다크 모드로 전환',
  dark:     '레드 모드로 전환',
  red:      '페라리 모드로 전환',
  ferrari:  '미드나잇 모드로 전환',
  midnight: '오로라 모드로 전환',
  aurora:   '옵시디언 모드로 전환',
  obsidian: '라이트 모드로 전환',
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  const current = theme ?? 'dark';

  const colorCls =
    current === 'red'      ? 'text-red-500 hover:text-red-400' :
    current === 'ferrari'  ? 'text-[#DC0000] hover:text-red-500' :
    current === 'midnight' ? 'text-[#4f8eff] hover:text-blue-300' :
    current === 'aurora'   ? 'text-[#a855f7] hover:text-purple-400' :
    current === 'obsidian' ? 'text-[#c9a227] hover:text-yellow-400' :
    'text-tertiary hover:text-primary';

  return (
    <button
      onClick={() => setTheme(CYCLE[current] ?? 'dark')}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition hover:bg-card ${colorCls}`}
      title={LABEL[current]}
    >
      {ICON[current]}
      <span className="text-[11px] font-semibold tracking-wide">
        {ORDER.indexOf(current) + 1}. {NAME[current]}
      </span>
    </button>
  );
}
