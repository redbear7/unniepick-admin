'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Flame, CloudMoon, SunMedium, CloudSun, Snowflake, Building2, Ghost, Leaf, Flower2, Heart } from 'lucide-react';

const CYCLE: Record<string, string> = {
  light:      'dark',
  dark:       'ferrari',
  ferrari:    'obsidian',
  obsidian:   'sand',
  sand:       'sky',
  sky:        'nord',
  nord:       'tokyonight',
  tokyonight: 'dracula',
  dracula:    'mint',
  mint:       'lavender',
  lavender:   'peach',
  peach:      'light',
};
const ICON: Record<string, React.ReactNode> = {
  light:      <Moon      size={16} />,
  dark:       <Flame     size={16} />,
  ferrari:    <CloudMoon size={16} />,
  obsidian:   <SunMedium size={16} />,
  sand:       <CloudSun  size={16} />,
  sky:        <Sun       size={16} />,
  nord:       <Snowflake size={16} />,
  tokyonight: <Building2 size={16} />,
  dracula:    <Ghost     size={16} />,
  mint:       <Leaf      size={16} />,
  lavender:   <Flower2   size={16} />,
  peach:      <Heart     size={16} />,
};
const ORDER = ['light', 'dark', 'ferrari', 'obsidian', 'sand', 'sky', 'nord', 'tokyonight', 'dracula', 'mint', 'lavender', 'peach'];
const NAME: Record<string, string> = {
  light:      'Light',
  dark:       'Dark',
  ferrari:    'Ferrari',
  obsidian:   'Obsidian',
  sand:       'Sand',
  sky:        'Sky',
  nord:       'Nord',
  tokyonight: 'Tokyo',
  dracula:    'Dracula',
  mint:       'Mint',
  lavender:   'Lavender',
  peach:      'Peach',
};
const LABEL: Record<string, string> = {
  light:      '다크 모드로 전환',
  dark:       '페라리 모드로 전환',
  ferrari:    '옵시디언 모드로 전환',
  obsidian:   '샌드 모드로 전환',
  sand:       '스카이 모드로 전환',
  sky:        '노드 모드로 전환',
  nord:       '도쿄나잇 모드로 전환',
  tokyonight: '드라큘라 모드로 전환',
  dracula:    '민트 모드로 전환',
  mint:       '라벤더 모드로 전환',
  lavender:   '피치 모드로 전환',
  peach:      '라이트 모드로 전환',
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  const current = theme ?? 'dark';

  const colorCls =
    current === 'ferrari'    ? 'text-[#DC0000] hover:text-red-400' :
    current === 'obsidian'   ? 'text-[#c9a227] hover:text-yellow-400' :
    current === 'sand'       ? 'text-[#c2832a] hover:text-amber-600' :
    current === 'sky'        ? 'text-[#0ea5e9] hover:text-sky-400' :
    current === 'nord'       ? 'text-[#88c0d0] hover:text-cyan-300' :
    current === 'tokyonight' ? 'text-[#7aa2f7] hover:text-blue-300' :
    current === 'dracula'    ? 'text-[#bd93f9] hover:text-purple-300' :
    current === 'mint'       ? 'text-[#10b981] hover:text-emerald-400' :
    current === 'lavender'   ? 'text-[#8b5cf6] hover:text-violet-400' :
    current === 'peach'      ? 'text-[#f97316] hover:text-orange-400' :
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
