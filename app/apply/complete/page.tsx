'use client';

/**
 * /apply/complete?token=<review_token>
 *
 * 가게 등록 신청 직후 리다이렉트되는 완료 페이지.
 * ApplicationStatusView에 isNew=true 전달 → 상단 완료 배너 표시.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ApplicationStatusView from '@/components/ApplicationStatusView';
import Link from 'next/link';

function CompletePage() {
  const params = useSearchParams();
  const token  = params.get('token') ?? '';

  if (!token) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-2xl">🤔</p>
        <p className="text-gray-600 text-sm">올바르지 않은 접근입니다.</p>
        <Link href="/apply" className="px-5 py-2.5 bg-[#FF6F0F] text-white text-sm font-bold rounded-xl">
          가게 등록하기
        </Link>
      </div>
    );
  }

  return <ApplicationStatusView token={token} isNew={true} />;
}

export default function ApplyCompletePage() {
  return (
    <Suspense>
      <CompletePage />
    </Suspense>
  );
}
