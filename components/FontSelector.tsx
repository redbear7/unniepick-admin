'use client';

import { useState, useEffect, useRef } from 'react';
import { Type, Check } from 'lucide-react';

const FONTS = [
  {
    id: 'system',
    name: '기본',
    label: 'System',
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    url: null,
  },
  {
    id: 'pretendard',
    name: 'Pretendard',
    label: 'Pretendard',
    family: '"Pretendard Variable", Pretendard, -apple-system, sans-serif',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css',
  },
  {
    id: 'noto',
    name: 'Noto Sans KR',
    label: 'Noto Sans',
    family: '"Noto Sans KR", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap',
  },
  {
    id: 'nanum',
    name: '나눔고딕',
    label: '나눔고딕',
    family: '"Nanum Gothic", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&display=swap',
  },
  {
    id: 'gothic',
    name: 'Gothic A1',
    label: 'Gothic A1',
    family: '"Gothic A1", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700&display=swap',
  },
  {
    id: 'ibm',
    name: 'IBM Plex KR',
    label: 'IBM Plex',
    family: '"IBM Plex Sans KR", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap',
  },
  {
    id: 'gowun',
    name: '고운돋움',
    label: '고운돋움',
    family: '"Gowun Dodum", sans-serif',
    url: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap',
  },
];

const LS_KEY = 'admin_font';

function loadFontUrl(url: string) {
  if (document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

function applyFont(family: string) {
  document.body.style.fontFamily = family;
}

export default function FontSelector() {
  const [open, setOpen]       = useState(false);
  const [fontId, setFontId]   = useState('system');
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(LS_KEY) ?? 'system';
    const font  = FONTS.find(f => f.id === saved) ?? FONTS[0];
    setFontId(font.id);
    if (font.url) loadFontUrl(font.url);
    applyFont(font.family);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!mounted) return <div className="w-24 h-8" />;

  const current = FONTS.find(f => f.id === fontId) ?? FONTS[0];

  function select(font: typeof FONTS[0]) {
    if (font.url) loadFontUrl(font.url);
    applyFont(font.family);
    setFontId(font.id);
    localStorage.setItem(LS_KEY, font.id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 transition text-tertiary hover:opacity-70"
        title="폰트 변경"
      >
        <Type size={14} />
        <span className="text-[11px] font-semibold tracking-wide">{current.label}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 w-44 bg-card border border-border-main rounded-xl shadow-xl z-[200] py-1.5 overflow-hidden">
          {FONTS.map(font => (
            <button
              key={font.id}
              onClick={() => select(font)}
              style={{ fontFamily: font.family }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-fill-subtle transition text-left"
            >
              <span className={fontId === font.id ? 'text-accent font-semibold' : 'text-primary'}>
                {font.name}
              </span>
              {fontId === font.id && <Check size={12} className="text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
