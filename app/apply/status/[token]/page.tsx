/**
 * /apply/status/[token]
 *
 * SMS 링크로 재방문하는 신청 내역 확인 페이지.
 * ApplicationStatusView에 isNew=false 전달 → 완료 배너 없이 내역만 표시.
 */

import ApplicationStatusView from '@/components/ApplicationStatusView';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ApplicationStatusPage({ params }: Props) {
  const { token } = await params;
  return <ApplicationStatusView token={token} />;
}

export function generateMetadata() {
  return {
    title: '가게 등록 신청 확인 | 언니픽',
    description: '언니픽 가게 등록 신청 내역을 확인하세요',
  };
}
