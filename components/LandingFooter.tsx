import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer className="border-t border-border-main bg-card">
      <div className="max-w-6xl mx-auto px-5 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#FF6F0F] flex items-center justify-center text-xs">🍖</div>
              <span className="font-bold text-primary">언니픽</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              AI 기반 매장 음악·안내방송·마케팅<br />올인원 솔루션
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-dim uppercase tracking-wider mb-3">제품</p>
            <ul className="space-y-2 text-sm text-tertiary">
              <li><Link href="/#features" className="hover:text-primary transition">기능</Link></li>
              <li><Link href="/#pricing" className="hover:text-primary transition">요금제</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold text-dim uppercase tracking-wider mb-3">지원</p>
            <ul className="space-y-2 text-sm text-tertiary">
              <li><Link href="/apply" className="hover:text-primary transition">가게 등록</Link></li>
              <li><a href="mailto:support@unniepick.com" className="hover:text-primary transition">문의하기</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold text-dim uppercase tracking-wider mb-3">법적 고지</p>
            <ul className="space-y-2 text-sm text-tertiary">
              <li><a href="#" className="hover:text-primary transition">개인정보처리방침</a></li>
              <li><a href="#" className="hover:text-primary transition">이용약관</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border-main flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-dim">&copy; 2025 언니픽. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
