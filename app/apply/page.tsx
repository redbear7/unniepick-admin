'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ApplyModal from '@/components/ApplyModal';

export default function ApplyPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    router.back();
  };

  return <ApplyModal isOpen={open} onClose={handleClose} />;
}
