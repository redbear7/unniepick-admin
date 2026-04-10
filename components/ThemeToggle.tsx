'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Sun, Moon, Flame, CloudMoon, SunMedium, CloudSun,
  Snowflake, Building2, Ghost, Leaf, Flower2, Heart,
  Coffee, Palette, Terminal, Zap, Code2, Sunrise,
  FileText, Flower, Lightbulb, Gauge, Trophy, Monitor,
} from 'lucide-react';

const CYCLE: Record<string, string> = {
  light:       'dark',
  dark:        'ferrari',
  ferrari:     'obsidian',
  obsidian:    'sand',
  sand:        'sky',
  sky:         'nord',
  nord:        'tokyonight',
  tokyonight:  'dracula',
  dracula:     'mint',
  mint:        'lavender',
  lavender:    'peach',
  peach:       'catppuccin',
  catppuccin:  'gruvbox',
  gruvbox:     'matrix',
  matrix:      'cyberpunk',
  cyberpunk:   'onedark',
  onedark:     'solarized',
  solarized:   'paper',
  paper:       'rose',
  rose:        'lemon',
  lemon:       'lamborghini',
  lamborghini: 'porsche',
  porsche:     'oled',
  oled:        'light',
};

const ICON: Record<string, React.ReactNode> = {
  light:       <Moon      size={16} />,
  dark:        <Flame     size={16} />,
  ferrari:     <CloudMoon size={16} />,
  obsidian:    <SunMedium size={16} />,
  sand:        <CloudSun  size={16} />,
  sky:         <Sun       size={16} />,
  nord:        <Snowflake size={16} />,
  tokyonight:  <Building2 size={16} />,
  dracula:     <Ghost     size={16} />,
  mint:        <Leaf      size={16} />,
  lavender:    <Flower2   size={16} />,
  peach:       <Heart     size={16} />,
  catppuccin:  <Coffee    size={16} />,
  gruvbox:     <Palette   size={16} />,
  matrix:      <Terminal  size={16} />,
  cyberpunk:   <Zap       size={16} />,
  onedark:     <Code2     size={16} />,
  solarized:   <Sunrise   size={16} />,
  paper:       <FileText  size={16} />,
  rose:        <Flower    size={16} />,
  lemon:       <Lightbulb size={16} />,
  lamborghini: <Gauge     size={16} />,
  porsche:     <Trophy    size={16} />,
  oled:        <Monitor   size={16} />,
};

const ORDER = [
  'light','dark','ferrari','obsidian','sand','sky',
  'nord','tokyonight','dracula','mint','lavender','peach',
  'catppuccin','gruvbox','matrix','cyberpunk','onedark','solarized',
  'paper','rose','lemon','lamborghini','porsche','oled',
];

const NAME: Record<string, string> = {
  light:       'Light',
  dark:        'Dark',
  ferrari:     'Ferrari',
  obsidian:    'Obsidian',
  sand:        'Sand',
  sky:         'Sky',
  nord:        'Nord',
  tokyonight:  'Tokyo',
  dracula:     'Dracula',
  mint:        'Mint',
  lavender:    'Lavender',
  peach:       'Peach',
  catppuccin:  'Catppuccin',
  gruvbox:     'Gruvbox',
  matrix:      'Matrix',
  cyberpunk:   'Cyberpunk',
  onedark:     'One Dark',
  solarized:   'Solarized',
  paper:       'Paper',
  rose:        'Rose',
  lemon:       'Lemon',
  lamborghini: 'Lambo',
  porsche:     'Porsche',
  oled:        'OLED',
};

const COLOR: Record<string, string> = {
  ferrari:     'text-[#DC0000]',
  obsidian:    'text-[#c9a227]',
  sand:        'text-[#c2832a]',
  sky:         'text-[#0ea5e9]',
  nord:        'text-[#88c0d0]',
  tokyonight:  'text-[#7aa2f7]',
  dracula:     'text-[#bd93f9]',
  mint:        'text-[#10b981]',
  lavender:    'text-[#8b5cf6]',
  peach:       'text-[#f97316]',
  catppuccin:  'text-[#cba6f7]',
  gruvbox:     'text-[#d79921]',
  matrix:      'text-[#00ff41]',
  cyberpunk:   'text-[#ff2d78]',
  onedark:     'text-[#61afef]',
  solarized:   'text-[#268bd2]',
  paper:       'text-[#6b7280]',
  rose:        'text-[#e11d48]',
  lemon:       'text-[#ca8a04]',
  lamborghini: 'text-[#e86900]',
  porsche:     'text-[#e30713]',
  oled:        'text-tertiary',
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-24 h-8" />;

  const current = theme ?? 'dark';
  const colorCls = COLOR[current] ?? 'text-tertiary';

  return (
    <button
      onClick={() => setTheme(CYCLE[current] ?? 'dark')}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition hover:bg-card hover:opacity-90 ${colorCls}`}
      title={`${NAME[CYCLE[current] ?? 'dark']} 모드로 전환`}
    >
      {ICON[current]}
      <span className="text-[11px] font-semibold tracking-wide">
        {ORDER.indexOf(current) + 1}. {NAME[current]}
      </span>
    </button>
  );
}
