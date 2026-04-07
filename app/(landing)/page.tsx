'use client';

import Link from 'next/link';
import {
  Music, Mic, BarChart3, Ticket, Zap, Shield,
  ChevronRight, Check, Star,
} from 'lucide-react';
import LandingNav from '@/components/LandingNav';
import LandingFooter from '@/components/LandingFooter';

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Music,
    title: 'AI BGM 큐레이션',
    desc: '매장 분위기, 시간대, 고객층에 맞는 음악을 AI가 자동 선곡합니다.',
  },
  {
    icon: Mic,
    title: 'AI 음성안내',
    desc: '운영 멘트, 주문 안내, 이벤트 공지를 자연스러운 AI 음성으로 자동 방송합니다.',
  },
  {
    icon: BarChart3,
    title: '매장 컨텍스트 분석',
    desc: '매장 환경을 분석하여 최적의 음악·안내 전략을 제안합니다.',
  },
  {
    icon: Ticket,
    title: '쿠폰 & 마케팅',
    desc: '디지털 쿠폰 발행, 고객 방문 유도, 리텐션 마케팅을 한 곳에서.',
  },
  {
    icon: Zap,
    title: '실시간 원격 관리',
    desc: '어디서든 앱으로 매장 음악, 안내방송, 쿠폰을 실시간 관리합니다.',
  },
  {
    icon: Shield,
    title: '저작권 걱정 없는 음악',
    desc: '모든 BGM은 상업적 사용이 허가된 음원만 제공합니다.',
  },
];

const PLANS = [
  {
    name: '스타터',
    price: '₩0',
    period: '/월',
    desc: '시작하는 매장을 위한 플랜',
    badge: '오픈 기념 무료',
    badgeColor: 'bg-emerald-500/15 text-emerald-400',
    features: [
      'BGM 플레이리스트 5개',
      'AI 음성안내 기본 템플릿',
      '쿠폰 발행 월 10건',
      '이메일 지원',
    ],
    cta: '무료로 시작하기',
    ctaStyle: 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main',
    popular: false,
  },
  {
    name: '프로',
    price: '₩19,900',
    period: '/월',
    desc: '성장하는 매장의 필수 플랜',
    badge: '가장 인기',
    badgeColor: 'bg-[#FF6F0F]/15 text-[#FF6F0F]',
    features: [
      '무제한 플레이리스트',
      'AI 음성안내 커스텀 TTS',
      'AI 자동 큐레이션',
      '매장 컨텍스트 분석',
      '쿠폰 무제한 발행',
      '우선 채팅 지원',
    ],
    cta: '프로 시작하기',
    ctaStyle: 'bg-[#FF6F0F] text-white hover:bg-[#e66000]',
    popular: true,
  },
  {
    name: '프리미엄',
    price: '₩39,900',
    period: '/월',
    desc: '다매장 운영자를 위한 플랜',
    badge: '',
    badgeColor: '',
    features: [
      '프로의 모든 기능',
      '다국어 AI 음성안내',
      '매장 5개까지 통합 관리',
      '고급 매출 분석 리포트',
      '전담 매니저 배정',
      'API 연동 지원',
    ],
    cta: '프리미엄 시작하기',
    ctaStyle: 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main',
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    quote: '매장 음악 때문에 매번 고민했는데, 언니픽이 알아서 분위기에 맞게 틀어줘서 너무 편해요.',
    name: '김사장님',
    role: '카페 운영 3년차',
  },
  {
    quote: 'AI 음성안내가 진짜 자연스러워요. 손님들이 직원이 말하는 줄 알았다고 해요.',
    name: '이사장님',
    role: '베이커리 운영',
  },
  {
    quote: '쿠폰 기능으로 단골 관리가 확실히 쉬워졌어요. 재방문율이 눈에 띄게 올랐습니다.',
    name: '박사장님',
    role: '음식점 2호점 운영',
  },
];

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-primary">

      <LandingNav />

      {/* ═══════ HERO ═══════ */}
      <section className="max-w-4xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] text-xs font-bold mb-6">
          <Zap size={12} /> 오픈 기념 전 매장 무료
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
          매장 음악, AI가<br />
          <span className="text-[#FF6F0F]">알아서 틀어드립니다</span>
        </h1>

        <p className="mt-6 text-lg text-tertiary max-w-2xl mx-auto leading-relaxed">
          AI BGM 큐레이션, 음성안내 방송, 쿠폰 마케팅까지.<br className="hidden sm:block" />
          매장 운영에 필요한 모든 것을 하나의 앱으로 관리하세요.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/apply"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#FF6F0F] hover:bg-[#e66000] text-white font-bold text-base transition shadow-lg shadow-[#FF6F0F]/20"
          >
            무료로 시작하기 <ChevronRight size={16} />
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-fill-subtle hover:bg-fill-medium text-secondary font-semibold text-base transition border border-border-main"
          >
            요금제 보기
          </a>
        </div>

        {/* Trust */}
        <div className="mt-16 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
          </div>
          <p className="text-xs text-muted">
            <span className="font-bold text-secondary">100+</span> 매장이 언니픽과 함께하고 있습니다
          </p>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-[#FF6F0F] mb-2">주요 기능</p>
          <h2 className="text-3xl font-extrabold">매장 운영, 이제 AI에게 맡기세요</h2>
          <p className="text-tertiary mt-3 max-w-lg mx-auto">
            복잡한 설정 없이 가입만 하면 바로 시작할 수 있습니다
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-card border border-border-main rounded-2xl p-6 hover:border-[#FF6F0F]/30 transition group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FF6F0F]/10 flex items-center justify-center mb-4 group-hover:bg-[#FF6F0F]/20 transition">
                <Icon size={20} className="text-[#FF6F0F]" />
              </div>
              <h3 className="font-bold text-primary mb-2">{title}</h3>
              <p className="text-sm text-tertiary leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ CTA BANNER ═══════ */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="bg-gradient-to-r from-[#FF6F0F] to-[#FF9F0F] rounded-3xl p-10 md:p-14 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            지금 바로 무료로 시작하세요
          </h2>
          <p className="text-white/80 mt-3 max-w-md mx-auto">
            오픈 기념으로 모든 기능을 무료로 체험할 수 있습니다.<br />
            신용카드 없이 바로 시작하세요.
          </p>
          <Link
            href="/apply"
            className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-2xl bg-white text-[#FF6F0F] font-bold text-base hover:bg-white/90 transition shadow-lg"
          >
            가게 등록 신청 <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-[#FF6F0F] mb-2">요금제</p>
          <h2 className="text-3xl font-extrabold">매장 규모에 맞는 플랜을 선택하세요</h2>
          <p className="text-tertiary mt-3">지금은 오픈 기념으로 <span className="font-bold text-[#FF6F0F]">전 플랜 무료</span>입니다</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-2xl p-7 flex flex-col ${
                plan.popular
                  ? 'border-2 border-[#FF6F0F] shadow-lg shadow-[#FF6F0F]/10'
                  : 'border border-border-main'
              }`}
            >
              {plan.badge && (
                <span className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-[11px] font-bold ${plan.badgeColor}`}>
                  {plan.badge}
                </span>
              )}

              <h3 className="text-lg font-bold text-primary mt-1">{plan.name}</h3>
              <p className="text-sm text-muted mt-1">{plan.desc}</p>

              <div className="mt-5 mb-6">
                <span className="text-3xl font-extrabold text-primary">{plan.price}</span>
                <span className="text-sm text-muted">{plan.period}</span>
              </div>

              <ul className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-secondary">
                    <Check size={15} className="text-[#FF6F0F] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/apply"
                className={`mt-8 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition ${plan.ctaStyle}`}
              >
                {plan.cta} <ChevronRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section id="reviews" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-[#FF6F0F] mb-2">사장님 후기</p>
          <h2 className="text-3xl font-extrabold">이미 많은 매장이 경험했습니다</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, name, role }) => (
            <div key={name} className="bg-card border border-border-main rounded-2xl p-6">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={12} className="text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-sm text-secondary leading-relaxed mb-6">&ldquo;{quote}&rdquo;</p>
              <div>
                <p className="text-sm font-bold text-primary">{name}</p>
                <p className="text-xs text-muted">{role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <h2 className="text-3xl font-extrabold">매장 운영, 더 쉬워질 준비 되셨나요?</h2>
        <p className="text-tertiary mt-4 max-w-lg mx-auto">
          복잡한 설정 없이 3분이면 가입 완료.<br />
          지금 무료로 시작하세요.
        </p>
        <Link
          href="/apply"
          className="inline-flex items-center gap-2 mt-8 px-10 py-4 rounded-2xl bg-[#FF6F0F] hover:bg-[#e66000] text-white font-bold text-base transition shadow-lg shadow-[#FF6F0F]/20"
        >
          무료로 시작하기 <ChevronRight size={16} />
        </Link>
      </section>

      <LandingFooter />
    </div>
  );
}
