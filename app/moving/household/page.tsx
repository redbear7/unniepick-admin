import MovingEstimateForm from '@/components/MovingEstimateForm';

export const metadata = { title: '가정이사 무료 견적 신청' };

export default function HouseholdMovingPage() {
  return <MovingEstimateForm type="household" />;
}
