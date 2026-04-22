'use client';

import { useEffect, useState, useCallback } from 'react';
import { PlayerProvider } from '@/contexts/PlayerContext';
import Sidebar from '@/components/Sidebar';
import BottomPlayer from '@/components/BottomPlayer';
import DevLogPanel from '@/components/DevLogPanel';
import ChatWidget from '@/components/ChatWidget';

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

  // DevLogPanel 펼침 상태를 공유 — ChatWidget 위치 연동에 사용
  const [devLogOpen, setDevLogOpen] = useState(false);
  const handleDevLogVisibility = useCallback((v: boolean) => setDevLogOpen(v), []);

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
      <DevLogPanel onVisibilityChange={handleDevLogVisibility} />

      {/* AI 어시스턴트 (시샵 전용) — DevLog 상태 연동 */}
      <ChatWidget devLogOpen={devLogOpen} />
    </PlayerProvider>
  );
}
