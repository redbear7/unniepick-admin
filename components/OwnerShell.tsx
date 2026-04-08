'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OwnerSidebar from '@/components/OwnerSidebar';
import MascotWidget from '@/components/MascotWidget';
import { Loader2 } from 'lucide-react';

interface OwnerSession {
  owner_pin_id: string;
  user_id:      string;
  name:         string;
  phone:        string;
  created_at:   string;
  exp:          number;
}

export function useOwnerSession() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('owner_session');
      if (!raw) { router.replace('/owner/login'); return; }
      const s: OwnerSession = JSON.parse(raw);
      if (s.exp <= Date.now()) {
        localStorage.removeItem('owner_session');
        router.replace('/owner/login');
        return;
      }
      setSession(s);
    } catch {
      router.replace('/owner/login');
    } finally {
      setReady(true);
    }
  }, [router]);

  return { session, ready };
}

export default function OwnerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, ready } = useOwnerSession();

  const handleLogout = () => {
    localStorage.removeItem('owner_session');
    router.replace('/owner/login');
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 size={28} className="animate-spin text-[#FF6F0F]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <OwnerSidebar name={session.name} onLogout={handleLogout} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <MascotWidget userId={session.user_id} />
    </div>
  );
}
