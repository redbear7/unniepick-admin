import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '마인드맵 채팅',
};

// 대시보드 레이아웃(사이드바/플레이어) 없이 팝업 전용 렌더링
export default function MindmapPopupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
