import Da24Header from '@/components/Da24Header';
import Da24Footer from '@/components/Da24Footer';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Da24Header />
      <main className="flex-1">{children}</main>
      <Da24Footer />
    </div>
  );
}
