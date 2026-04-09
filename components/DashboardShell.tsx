'use client';

import { useEffect } from 'react';
import { PlayerProvider } from '@/contexts/PlayerContext';
import Sidebar from '@/components/Sidebar';
import BottomPlayer from '@/components/BottomPlayer';
import DevLogPanel from '@/components/DevLogPanel';

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
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>

        {/* 하단 음악 플레이어 — 항상 화면 최하단 */}
        <BottomPlayer />
      </div>

      {/* 개발자 로그 패널 */}
      <DevLogPanel />
    </PlayerProvider>
  );
}
