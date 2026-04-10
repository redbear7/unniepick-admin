import Link from 'next/link';

export default function Da24Footer() {
  return (
    <footer className="bg-card border-t border-border-main">
      <div className="max-w-[640px] mx-auto px-4 py-8">
        {/* Brand */}
        <div className="mb-5">
          <span className="text-lg font-extrabold text-[#FF6F0F] tracking-tight">DA24</span>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            대한민국 No.1 이사 비교 플랫폼<br />
            투명한 이사 견적, 믿을 수 있는 업체
          </p>
        </div>

        {/* Links */}
        <div className="grid grid-cols-3 gap-4 text-xs text-tertiary mb-6">
          <div className="space-y-2">
            <p className="font-bold text-secondary">이사 서비스</p>
            <Link href="/#moving-categories" className="block hover:text-primary transition">가정이사</Link>
            <Link href="/#moving-categories" className="block hover:text-primary transition">소형이사</Link>
            <Link href="/#moving-categories" className="block hover:text-primary transition">사무실이사</Link>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-secondary">부가서비스</p>
            <Link href="/#extra-services" className="block hover:text-primary transition">입주청소</Link>
            <Link href="/internet" className="block hover:text-primary transition">인터넷 비교</Link>
            <Link href="/#extra-services" className="block hover:text-primary transition">에어컨</Link>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-secondary">고객지원</p>
            <a href="tel:1588-0000" className="block hover:text-primary transition">고객센터</a>
            <a href="#" className="block hover:text-primary transition">자주 묻는 질문</a>
            <a href="#" className="block hover:text-primary transition">업체 등록</a>
          </div>
        </div>

        <div className="pt-4 border-t border-border-subtle text-[10px] text-dim space-y-1">
          <p>주식회사 DA24 | 사업자등록번호: 000-00-00000</p>
          <p>대표이사: 홍길동 | 통신판매업신고: 제 0000-서울-00000호</p>
          <div className="flex gap-4 mt-2">
            <a href="#" className="hover:text-muted transition">개인정보처리방침</a>
            <a href="#" className="hover:text-muted transition">이용약관</a>
          </div>
          <p className="mt-1">© 2025 DA24. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
