'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function OwnerPreviewPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const s = params.get('s');
    if (!s) { router.replace('/owner/login'); return; }
    try {
      const session = JSON.parse(atob(s));
      if (!session?.owner_pin_id) throw new Error('invalid');
      localStorage.setItem('owner_session', JSON.stringify(session));
      router.replace('/owner/dashboard');
    } catch {
      router.replace('/owner/login');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#FF6F0F]" />
    </div>
  );
}
