'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerIndex() {
  const router = useRouter();
  useEffect(() => {
    try {
      const raw = localStorage.getItem('owner_session');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.exp > Date.now()) { router.replace('/owner/dashboard'); return; }
      }
    } catch {}
    router.replace('/owner/login');
  }, [router]);
  return null;
}
