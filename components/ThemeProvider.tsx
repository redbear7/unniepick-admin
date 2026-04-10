'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={['light', 'dark', 'ferrari', 'obsidian', 'sand', 'sky', 'nord', 'tokyonight', 'dracula', 'mint', 'lavender', 'peach']}>
      {children}
    </NextThemesProvider>
  );
}
