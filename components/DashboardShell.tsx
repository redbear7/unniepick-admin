'use client';

import { useEffect } from 'react';
import { PlayerProvider } from '@/contexts/PlayerContext';
import Sidebar from '@/components/Sidebar';
import BottomPlayer from '@/components/BottomPlayer';
import DevLogPanel from '@/components/DevLogPanel';
import ThemeToggle from '@/components/ThemeToggle';
import FontSelector from '@/components/FontSelector';
import AudioBars from '@/components/AudioBars';
import NowPlayingChip from '@/components/NowPlayingChip';

function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('[SW] 등록 실패:', e.message);
      });
    }
  }, []);
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  useServiceWorker();

  return (
    <PlayerProvider>
      <div className="flex flex-col h-screen bg-surface overflow-hidden">
        {/* 사이드바 + 메인 */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto flex flex-col">
            <AudioBars />
            <div className="flex-1">{children}</div>
          </main>
        </div>

        {/* 하단 음악 플레이어 — 항상 화면 최하단 */}
        <BottomPlayer />
      </div>

      {/* 개발자 로그 패널 */}
      <DevLogPanel />

      {/* 테마 토글 + 폰트 선택 — 메인 영역 상단 중앙 고정 */}
      {/* 테마 토글 + 폰트 선택 */}
      <div
        className="fixed top-3 z-50 flex items-center gap-0.5 bg-card/80 backdrop-blur border border-border-main rounded-xl px-1 shadow-sm"
        style={{ left: 'calc(14rem + (100vw - 14rem) / 2)', transform: 'translateX(-50%)' }}
      >
        <ThemeToggle />
        <div className="w-px h-4 bg-border-main" />
        <FontSelector />
      </div>

      {/* 현재 재생 트랙 제목 */}
      <div
        className="fixed top-16 z-50"
        style={{ left: 'calc(14rem + (100vw - 14rem) / 2)', transform: 'translateX(-50%)' }}
      >
        <NowPlayingChip />
      </div>
    </PlayerProvider>
  );
}
