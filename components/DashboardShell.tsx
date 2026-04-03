'use client';

import { PlayerProvider } from '@/contexts/PlayerContext';
import Sidebar from '@/components/Sidebar';
import BottomPlayer from '@/components/BottomPlayer';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <div className="flex flex-col h-screen bg-[#0D0F14] overflow-hidden">
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
    </PlayerProvider>
  );
}
