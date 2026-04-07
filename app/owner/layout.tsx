import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '언니픽 사장님 어드민',
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {children}
    </div>
  );
}
