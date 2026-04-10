import LandingNav from '@/components/LandingNav';
import LandingFooter from '@/components/LandingFooter';

export default function AirconLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <LandingNav />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
