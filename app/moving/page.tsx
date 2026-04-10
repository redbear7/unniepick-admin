import Link from 'next/link';
import { Home, Package, Building2, ChevronRight } from 'lucide-react';

const TYPES = [
  {
    href: '/moving/household',
    label: '가정이사',
    desc: '아파트·빌라·단독주택 등 일반 가정 이사',
    icon: Home,
    color: '#FF6F0F',
    bg: '#FF6F0F22',
  },
  {
    href: '/moving/small',
    label: '소형이사',
    desc: '원룸·고시원·1인 가구 소규모 이사',
    icon: Package,
    color: '#3B82F6',
    bg: '#3B82F622',
  },
  {
    href: '/moving/office',
    label: '사무실이사',
    desc: '사무실·상가·매장 등 비즈니스 이사',
    icon: Building2,
    color: '#8B5CF6',
    bg: '#8B5CF622',
  },
];

export default function MovingPage() {
  return (
    <div className="flex-1 flex flex-col items-center px-5 py-14">
      <div className="w-full max-w-lg space-y-6">

        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-3">이사 무료 견적</h1>
          <p className="text-sm text-muted leading-relaxed">
            이사 유형을 선택하시면<br />맞춤 견적을 무료로 받아보실 수 있습니다
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {TYPES.map(({ href, label, desc, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 bg-card border border-border-main rounded-2xl p-5 hover:bg-card-hover transition group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: bg }}
              >
                <Icon size={22} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-primary text-base">{label}</p>
                <p className="text-xs text-muted mt-0.5">{desc}</p>
              </div>
              <ChevronRight size={18} className="text-dim group-hover:text-tertiary transition shrink-0" />
            </Link>
          ))}
        </div>

        <div className="bg-card border border-border-main rounded-2xl p-4 text-center">
          <p className="text-xs text-muted leading-relaxed">
            🚚 전국 어디든 · 무료 견적 · 당일 상담 가능<br />
            <span className="text-dim">입력 정보는 견적 안내 목적으로만 사용됩니다</span>
          </p>
        </div>

      </div>
    </div>
  );
}
