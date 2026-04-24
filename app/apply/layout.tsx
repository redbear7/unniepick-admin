import LandingNav from '@/components/LandingNav';
import LandingFooter from '@/components/LandingFooter';

/**
 * /apply 레이아웃 — 공개 점주 등록 페이지
 * ThemeProvider(다크)와 무관하게 항상 라이트 모드로 강제
 * CSS 변수를 라이트 값으로 통째로 덮어씀
 */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={
        {
          /* ── 배경 / 서피스 ── */
          '--bg-surface':       '#f8f9fa',
          '--bg-sidebar':       '#ffffff',
          '--bg-card':          '#ffffff',
          '--bg-card-hover':    '#f3f4f6',
          /* ── 텍스트 ── */
          '--text-primary':     '#0d1117',
          '--text-secondary':   '#1f2937',
          '--text-tertiary':    '#4b5563',
          '--text-muted':       '#6b7280',
          '--text-dim':         '#9ca3af',
          /* ── 보더 / 필 ── */
          '--border-main':      'rgba(0,0,0,0.12)',
          '--border-subtle':    'rgba(0,0,0,0.14)',
          '--fill-subtle':      'rgba(0,0,0,0.04)',
          '--fill-medium':      'rgba(0,0,0,0.08)',
          /* ── 실제 배경 ── */
          backgroundColor:      '#ffffff',
          colorScheme:          'light',
        } as React.CSSProperties
      }
    >
      <LandingNav />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
