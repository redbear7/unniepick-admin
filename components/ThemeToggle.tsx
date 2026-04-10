'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Flame } from 'lucide-react';

const CYCLE: Record<string, string> = { light: 'dark', dark: 'red', red: 'light' };
const ICON: Record<string, React.ReactNode> = {
  light: <Moon  size={16} />,
  dark:  <Flame size={16} />,
  red:   <Sun   size={16} />,
};
const LABEL: Record<string, string> = {
  light: '다크 모드',
  dark:  '레드 모드',
  red:   '라이트 모드',
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  const current = theme ?? 'dark';

  return (
    <button
      onClick={() => setTheme(CYCLE[current] ?? 'dark')}
      className={`p-2 rounded-lg transition hover:bg-card ${
        current === 'red' ? 'text-red-400 hover:text-red-300' : 'text-tertiary hover:text-primary'
      }`}
      title={LABEL[current]}
    >
      {ICON[current]}
    </button>
  );
}
