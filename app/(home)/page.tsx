'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Home, Package, Building2, Sparkles, Wifi, Wind,
  Star, ChevronRight, ChevronLeft, CreditCard, Repeat2,
  Shield, Clock, Users,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────
   Data
──────────────────────────────────────────────────────────── */

const MOVING_CATEGORIES = [
  {
    id: 'household',
    icon: Home,
    label: '가정이사',
    sub: '3룸 · 15평 이상',
    tags: ['아파트', '빌라', '주택'],
    color: '#FF6F0F',
    bg: '#FF6F0F15',
  },
  {
    id: 'small',
    icon: Package,
    label: '소형이사',
    sub: '15평 미만',
    tags: ['원룸', '투룸', '오피스텔'],
    color: '#3B82F6',
    bg: '#3B82F615',
  },
  {
    id: 'office',
    icon: Building2,
    label: '사무실이사',
    sub: '1톤 초과',
    tags: ['빌딩', '공장', '상가'],
    color: '#8B5CF6',
    bg: '#8B5CF615',
  },
];

const EXTRA_SERVICES = [
  {
    id: 'cleaning',
    icon: Sparkles,
    label: '입주청소',
    desc: '전문 청소 업체 비교',
    badge: 'BEST',
    badgeColor: '#FF6F0F',
    href: '/#extra-services',
  },
  {
    id: 'internet',
    icon: Wifi,
    label: '인터넷',
    desc: '최대 현금 지원',
    badge: '현금지원',
    badgeColor: '#10B981',
    href: '/#extra-services',
  },
  {
    id: 'aircon',
    icon: Wind,
    label: '에어컨',
    desc: '설치 · 이전 · 청소',
    badge: null,
    badgeColor: null,
    href: '/#extra-services',
  },
];

const PROMO_BANNERS = [
  {
    id: 1,
    title: '봄 이사 시즌 특가',
    desc: '3~5월 이사 견적 최대 20% 할인',
    emoji: '🌸',
    gradient: 'from-[#FF6F0F] to-[#FF9F0F]',
  },
  {
    id: 2,
    title: '인터넷 신규 가입',
    desc: '이사와 함께 신청 시 현금 최대 30만원',
    emoji: '📡',
    gradient: 'from-[#3B82F6] to-[#06B6D4]',
  },
  {
    id: 3,
    title: '해피이사 캐시백',
    desc: '첫 이사 예약 고객 2만원 캐시백',
    emoji: '🎉',
    gradient: 'from-[#8B5CF6] to-[#EC4899]',
  },
];

const REVIEWS = [
  {
    id: 1,
    company: '한강이사',
    rating: 5,
    date: '2025.03.15',
    text: '친절하고 꼼꼼하게 짐을 포장해 주셨어요. 깨진 것 하나 없이 완벽하게 이사했습니다.',
    user: '김*영',
    category: '가정이사',
  },
  {
    id: 2,
    company: '스마트이사',
    rating: 5,
    date: '2025.03.10',
    text: '견적이 투명하고 추가 비용 없이 처리해 줬어요. 다음에도 꼭 이용할게요!',
    user: '이*수',
    category: '소형이사',
  },
  {
    id: 3,
    company: '프리미엄무브',
    rating: 4,
    date: '2025.03.05',
    text: '사무실 이사인데 업무 중단 없이 신속하게 완료. 정말 전문적이었어요.',
    user: '박*진',
    category: '사무실이사',
  },
  {
    id: 4,
    company: '행복이사',
    rating: 5,
    date: '2025.02.28',
    text: '가격도 적당하고 작업자분들이 매너가 너무 좋으셨어요. 강력 추천합니다.',
    user: '최*연',
    category: '가정이사',
  },
  {
    id: 5,
    company: '안심이사',
    rating: 5,
    date: '2025.02.20',
    text: 'DA24에서 비교하고 골랐는데 대박이었어요. 시간도 딱 지켜주고 깔끔해요.',
    user: '정*민',
    category: '소형이사',
  },
];

const LOAN_CONTENT = [
  { icon: CreditCard, title: '이사 비용 대출', desc: '최대 300만원 저금리 대출', rate: '연 3.5%~', badge: '즉시승인' },
  { icon: Shield, title: '무이자 할부', desc: '카드사 제휴 무이자 6개월', rate: '0% 이자', badge: '인기' },
  { icon: Clock, title: '선결제 서비스', desc: '이사 후 결제, 최대 30일 유예', rate: '수수료 0원', badge: null },
];

const RENTAL_CONTENT = [
  { icon: Repeat2, title: '냉장고 렌탈', desc: 'LG · 삼성 최신 모델', rate: '월 29,900원~', badge: '최저가' },
  { icon: Wind, title: '에어컨 렌탈', desc: '설치 포함 올인원', rate: '월 19,900원~', badge: null },
  { icon: Users, title: '가전 패키지', desc: '세탁기·냉장고·에어컨 세트', rate: '월 59,900원~', badge: '추천' },
];

/* ────────────────────────────────────────────────────────────
   Sub-components
──────────────────────────────────────────────────────────── */

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={11}
          className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-border-main'}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────── */

export default function Da24HomePage() {
  const [activeTab, setActiveTab] = useState<'loan' | 'rental'>('loan');
  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* auto-advance banner */
  useEffect(() => {
    bannerTimer.current = setInterval(() => {
      setBannerIdx(i => (i + 1) % PROMO_BANNERS.length);
    }, 3500);
    return () => { if (bannerTimer.current) clearInterval(bannerTimer.current); };
  }, []);

  const prevBanner = () => {
    setBannerIdx(i => (i - 1 + PROMO_BANNERS.length) % PROMO_BANNERS.length);
    if (bannerTimer.current) clearInterval(bannerTimer.current);
  };
  const nextBanner = () => {
    setBannerIdx(i => (i + 1) % PROMO_BANNERS.length);
    if (bannerTimer.current) clearInterval(bannerTimer.current);
  };

  const tabContent = activeTab === 'loan' ? LOAN_CONTENT : RENTAL_CONTENT;

  return (
    <div className="max-w-[640px] mx-auto pb-10">

      {/* ══════ 1. 이사 카테고리 ══════ */}
      <section id="moving-categories" className="px-4 pt-5 pb-2">
        <h2 className="text-base font-bold text-primary mb-3">이사 유형 선택</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {MOVING_CATEGORIES.map(({ id, icon: Icon, label, sub, tags, color, bg }) => (
            <Link
              key={id}
              href={`/moving/${id}`}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border-main bg-card hover:border-[var(--color)] active:scale-95 transition"
              style={{ '--color': color } as React.CSSProperties}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={24} style={{ color }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-primary">{label}</p>
                <p className="text-[10px] text-muted mt-0.5">{sub}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{ background: bg, color }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════ 2. 부가서비스 ══════ */}
      <section id="extra-services" className="px-4 pt-5 pb-2">
        <h2 className="text-base font-bold text-primary mb-3">부가서비스</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {EXTRA_SERVICES.map(({ id, icon: Icon, label, desc, badge, badgeColor, href }) => (
            <Link
              key={id}
              href={href}
              className="relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-border-main bg-card hover:bg-card-hover active:scale-95 transition"
            >
              {badge && (
                <span
                  className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-white text-[9px] font-bold whitespace-nowrap"
                  style={{ background: badgeColor ?? '#FF6F0F' }}
                >
                  {badge}
                </span>
              )}
              <div className="w-12 h-12 rounded-xl bg-fill-subtle flex items-center justify-center">
                <Icon size={22} className="text-secondary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-primary">{label}</p>
                <p className="text-[10px] text-muted mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════ 3. 대출/렌탈 탭 ══════ */}
      <section className="px-4 pt-5 pb-2">
        {/* Tab bar */}
        <div className="flex rounded-xl bg-fill-subtle p-1 mb-3">
          {(['loan', 'rental'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                activeTab === tab
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted'
              }`}
            >
              {tab === 'loan' ? '💰 대출' : '🔄 렌탈'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-2">
          {tabContent.map(({ icon: Icon, title, desc, rate, badge }) => (
            <div key={title} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border-main">
              <div className="w-10 h-10 rounded-xl bg-[#FF6F0F]/10 flex items-center justify-center shrink-0">
                <Icon size={20} className="text-[#FF6F0F]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-primary">{title}</p>
                  {badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] text-[9px] font-bold">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">{desc}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-[#FF6F0F]">{rate}</p>
                <ChevronRight size={14} className="text-muted ml-auto mt-1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ 4. 프로모 배너 슬라이더 ══════ */}
      <section className="px-4 pt-5">
        <div className="relative overflow-hidden rounded-2xl">
          {/* Banner slides */}
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
          >
            {PROMO_BANNERS.map(banner => (
              <div
                key={banner.id}
                className={`min-w-full bg-gradient-to-r ${banner.gradient} p-5 flex items-center justify-between`}
              >
                <div>
                  <p className="text-white/80 text-xs font-semibold mb-1">DA24 프로모션</p>
                  <p className="text-white text-lg font-extrabold leading-tight">{banner.title}</p>
                  <p className="text-white/80 text-sm mt-1">{banner.desc}</p>
                </div>
                <div className="text-5xl ml-4 shrink-0">{banner.emoji}</div>
              </div>
            ))}
          </div>

          {/* Arrow controls */}
          <button
            onClick={prevBanner}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/30 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextBanner}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/30 transition"
          >
            <ChevronRight size={16} />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {PROMO_BANNERS.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIdx(i)}
                className={`rounded-full transition-all ${
                  i === bannerIdx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ══════ 5. 이사업체 고객 평가 ══════ */}
      <section className="pt-6">
        <div className="px-4 flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-primary">이사업체 고객 평가</h2>
          <button className="flex items-center gap-0.5 text-xs font-semibold text-[#FF6F0F]">
            더보기 <ChevronRight size={13} />
          </button>
        </div>

        {/* Horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {REVIEWS.map(review => (
            <div
              key={review.id}
              className="min-w-[240px] max-w-[240px] bg-card border border-border-main rounded-2xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-primary">{review.company}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-fill-subtle text-muted font-medium">
                    {review.category}
                  </span>
                </div>
                <Stars rating={review.rating} />
              </div>
              <p className="text-xs text-secondary leading-relaxed flex-1 line-clamp-3">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>{review.user}</span>
                <span>{review.date}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ 6. 해피이사 캠페인 배너 ══════ */}
      <section className="px-4 pt-5">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#FF6F0F]/10 -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-[#3B82F6]/10 translate-y-8 -translate-x-8" />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF6F0F]/20 mb-3">
              <span className="text-[#FF6F0F] text-xs font-bold">🎊 해피이사 캠페인</span>
            </div>
            <h3 className="text-white text-xl font-extrabold leading-tight mb-2">
              행복한 이사의 시작,<br />
              <span className="text-[#FF6F0F]">DA24</span>와 함께
            </h3>
            <p className="text-white/60 text-sm mb-5">
              전국 5,000+ 검증된 이사업체<br />
              투명한 견적으로 이사 걱정 없이
            </p>
            <Link
              href="/moving/household"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6F0F] text-white text-sm font-bold hover:bg-[#e66000] transition"
            >
              무료 견적 받기 <ChevronRight size={14} />
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
            {[
              { value: '5,000+', label: '제휴 업체' },
              { value: '98%', label: '만족도' },
              { value: '50만+', label: '이용 고객' },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-white text-base font-extrabold">{stat.value}</p>
                <p className="text-white/50 text-[10px] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
