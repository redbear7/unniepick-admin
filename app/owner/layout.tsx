import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '언니픽 사장님 어드민',
};

// 로그인 / 대시보드 각자 layout을 사용하므로 여기서는 그냥 통과
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
