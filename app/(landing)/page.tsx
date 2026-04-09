'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Music, Mic, BarChart3, Ticket, Zap, Shield,
  ChevronRight, Check, Star, Film, Bell, Tag,
  Play, Pause, Volume2, VolumeX, Maximize2,
  ImagePlus, Megaphone,
} from 'lucide-react';
import LandingNav from '@/components/LandingNav';
import LandingFooter from '@/components/LandingFooter';
import { createClient } from '@/lib/supabase';
import { trackPlanClick } from '@/lib/gtag';

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Music,
    title: 'AI BGM 큐레이션',
    desc: '매장 분위기, 시간대, 고객층에 맞는 음악을 AI가 자동 선곡합니다.',
    badge: '',
  },
  {
    icon: Mic,
    title: 'AI 음성안내',
    desc: '운영 멘트, 주문 안내, 이벤트 공지를 자연스러운 AI 음성으로 자동 방송합니다.',
    badge: '',
  },
  {
    icon: Film,
    title: '숏폼 영상 자동 생성',
    desc: 'BGM에 맞춰 인스타·유튜브 숏츠용 영상을 자동으로 생성합니다. 업로드만 하면 끝.',
    badge: 'NEW',
  },
  {
    icon: ImagePlus,
    title: 'AI 카드뉴스 생성',
    desc: '이벤트·메뉴 소개 카드뉴스를 AI가 자동으로 디자인합니다.',
    badge: 'NEW',
  },
  {
    icon: Megaphone,
    title: '공지사항 & 알림',
    desc: '사장님 앱에 공지사항을 게시하고 실시간으로 매장 소식을 전달합니다.',
    badge: 'NEW',
  },
  {
    icon: BarChart3,
    title: '매장 컨텍스트 분석',
    desc: '매장 환경을 분석하여 최적의 음악·안내 전략을 제안합니다.',
    badge: '',
  },
  {
    icon: Ticket,
    title: '쿠폰 & 마케팅',
    desc: '디지털 쿠폰 발행, 고객 방문 유도, 리텐션 마케팅을 한 곳에서.',
    badge: '',
  },
  {
    icon: Tag,
    title: '무드 태그 관리',
    desc: '트랙별 무드·장르 태그를 분석해 매장에 최적화된 플레이리스트를 구성합니다.',
    badge: '',
  },
  {
    icon: Shield,
    title: '저작권 걱정 없는 음악',
    desc: '모든 BGM은 상업적 사용이 허가된 음원만 제공합니다.',
    badge: '',
  },
];

// 샘플 숏폼 영상 — 실제 Supabase Storage URL로 교체 가능
const SAMPLE_SHORTS = [
  {
    id: 1,
    title: '카페 모닝 무드',
    tag: 'lo-fi · morning-coffee',
    thumb: '',
    emoji: '☕',
    videoUrl: 'https://zdeuyjdmypfzmxmmxpon.supabase.co/storage/v1/object/public/music-tracks/shorts/5c35eb36-f774-4dd0-bfa3-5491adb234b1_1775544568595.mp4',
    color: '#6366f1',
  },
  {
    id: 2,
    title: '팝 업비트 에너지',
    tag: 'pop · upbeat',
    thumb: '',
    emoji: '🎸',
    videoUrl: 'https://zdeuyjdmypfzmxmmxpon.supabase.co/storage/v1/object/public/music-tracks/shorts/5c35eb36-f774-4dd0-bfa3-5491adb234b1_1775544568595.mp4',
    color: '#f43f5e',
  },
  {
    id: 3,
    title: '재즈 라운지 분위기',
    tag: 'jazz · lounge',
    thumb: '',
    emoji: '🎷',
    videoUrl: 'https://zdeuyjdmypfzmxmmxpon.supabase.co/storage/v1/object/public/music-tracks/shorts/5c35eb36-f774-4dd0-bfa3-5491adb234b1_1775544568595.mp4',
    color: '#d97706',
  },
];

interface Plan {
  id:          string;
  plan_type:   string;
  name:        string;
  price:       string;
  period:      string;
  description: string;
  badge:       string | null;
  badge_color: string | null;
  features:    string[];
  cta:         string;
  cta_style:   string;
  is_popular:  boolean;
  sort_order:  number;
}

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
    quote: '숏폼 영상을 이렇게 쉽게 만들 수 있다니 놀랍네요. 인스타에 바로 올렸어요.',
    name: '박사장님',
    role: '음식점 2호점 운영',
  },
];

/* ------------------------------------------------------------------ */
/* ShortVideoCard                                                       */
/* ------------------------------------------------------------------ */

function ShortVideoCard({ item }: { item: typeof SAMPLE_SHORTS[0] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted,   setMuted]   = useState(true);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else         { v.play();  setPlaying(true);  }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(m => !m);
    }
  };

  const openFull = (e: React.MouseEvent) => {
    e.stopPropagation();
    videoRef.current?.requestFullscreen?.();
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer group select-none"
      style={{ aspectRatio: '9/16', background: `linear-gradient(135deg, ${item.color}33, #1a1a2e)` }}
      onClick={toggle}
    >
      {/* 영상 */}
      {item.videoUrl ? (
        <video
          ref={videoRef}
          src={item.videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted={muted}
          playsInline
          onEnded={() => setPlaying(false)}
        />
      ) : (
        /* 샘플 영상 없을 때 플레이스홀더 */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="text-6xl">{item.emoji}</div>
          <div className="text-white/50 text-xs font-semibold">샘플 영상 준비 중</div>
        </div>
      )}

      {/* 오버레이 — 항상 표시 (그라디언트) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      {/* 상단 뱃지 */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold">
        <Film size={10} /> 숏폼
      </div>

      {/* 중앙 플레이 버튼 */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition">
            <Play size={22} className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* 하단 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white text-sm font-bold leading-tight">{item.title}</p>
        <p className="text-white/60 text-[11px] mt-0.5">{item.tag}</p>

        {/* 컨트롤 버튼 */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={e => { e.stopPropagation(); toggle(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold hover:bg-white/30 transition border border-white/20"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? '일시정지' : '재생'}
          </button>
          <button onClick={toggleMute}
            className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition">
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          {item.videoUrl && (
            <button onClick={openFull}
              className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition ml-auto">
              <Maximize2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* 재생 중 펄스 표시 */}
      {playing && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/80 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-white text-[10px] font-bold">LIVE</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    const sb = createClient();
    sb.from('plans')
      .select('id, plan_type, name, price, period, description, badge, badge_color, features, cta, cta_style, is_popular, sort_order')
      .eq('provider', 'unniepick')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (data) setPlans(data as Plan[]); });
  }, []);

  return (
    <div className="min-h-screen bg-surface text-primary">

      <LandingNav />

      {/* ═══════ HERO ═══════ */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] text-xs font-bold mb-6">
          <Zap size={12} /> 오픈 기념 전 매장 무료
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
          매장 음악부터 숏폼까지,<br />
          <span className="text-[#FF6F0F]">AI가 다 해드립니다</span>
        </h1>

        <p className="mt-6 text-lg text-tertiary max-w-2xl mx-auto leading-relaxed">
          AI BGM 큐레이션, 음성안내 방송, 숏폼 영상 자동 생성, 쿠폰 마케팅까지.<br className="hidden sm:block" />
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
            href="#shorts"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-fill-subtle hover:bg-fill-medium text-secondary font-semibold text-base transition border border-border-main"
          >
            <Film size={15} /> 숏폼 샘플 보기
          </a>
        </div>

        <div className="mt-16 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
          </div>
          <p className="text-xs text-muted">
            <span className="font-bold text-secondary">100+</span> 매장이 언니픽과 함께하고 있습니다
          </p>
        </div>
      </section>

      {/* ═══════ SHORTS DEMO ═══════ */}
      <section id="shorts" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6F0F]/10 text-[#FF6F0F] text-xs font-bold mb-3">
            <Film size={11} /> NEW
          </div>
          <h2 className="text-3xl font-extrabold">BGM으로 숏폼 영상 자동 생성</h2>
          <p className="text-tertiary mt-3 max-w-xl mx-auto leading-relaxed">
            트랙을 선택하고 버튼 하나만 누르면 인스타그램·유튜브 숏츠용 영상이 완성됩니다.<br />
            클라이맥스 구간 자동 선택, 파형 애니메이션, 쿠폰 삽입까지.
          </p>
        </div>

        {/* 숏폼 카드 3개 */}
        <div className="grid grid-cols-3 gap-5 max-w-2xl mx-auto">
          {SAMPLE_SHORTS.map(item => (
            <ShortVideoCard key={item.id} item={item} />
          ))}
        </div>

        {/* 숏폼 기능 태그 */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {[
            '🎵 클라이맥스 자동 추출',
            '📊 5가지 파형 스타일',
            '🎟 쿠폰 오버레이',
            '📐 인스타·유튜브 안전바',
            '⬇️ MP4 다운로드',
            '🎬 10~30초 길이 선택',
          ].map(tag => (
            <span key={tag} className="px-3 py-1.5 rounded-full bg-card border border-border-main text-xs text-secondary font-semibold">
              {tag}
            </span>
          ))}
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
          {FEATURES.map(({ icon: Icon, title, desc, badge }) => (
            <div
              key={title}
              className="relative bg-card border border-border-main rounded-2xl p-6 hover:border-[#FF6F0F]/30 transition group"
            >
              {badge && (
                <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-[#FF6F0F]/15 text-[#FF6F0F] text-[10px] font-bold">
                  {badge}
                </span>
              )}
              <div className="w-10 h-10 rounded-xl bg-[#FF6F0F]/10 flex items-center justify-center mb-4 group-hover:bg-[#FF6F0F]/20 transition">
                <Icon size={20} className="text-[#FF6F0F]" />
              </div>
              <h3 className="font-bold text-primary mb-2">{title}</h3>
              <p className="text-sm text-tertiary leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="max-w-4xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <p className="text-sm font-bold text-[#FF6F0F] mb-2">사용 방법</p>
          <h2 className="text-3xl font-extrabold">3단계로 끝나는 매장 음악 관리</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: '가게 등록', desc: '매장 정보를 입력하고 신청하면 관리자가 빠르게 승인합니다.', emoji: '🏪' },
            { step: '02', title: 'AI 선곡 시작', desc: '매장 분위기에 맞는 BGM이 자동으로 큐레이션됩니다.', emoji: '🎵' },
            { step: '03', title: '콘텐츠 자동 생성', desc: '숏폼 영상·카드뉴스·음성안내까지 원클릭으로 완성.', emoji: '✨' },
          ].map(({ step, title, desc, emoji }) => (
            <div key={step} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#FF6F0F]/10 flex items-center justify-center text-3xl mx-auto mb-4">
                {emoji}
              </div>
              <div className="text-[11px] font-bold text-[#FF6F0F] mb-1">STEP {step}</div>
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
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card rounded-2xl p-7 flex flex-col ${
                plan.is_popular
                  ? 'border-2 border-[#FF6F0F] shadow-lg shadow-[#FF6F0F]/10'
                  : 'border border-border-main'
              }`}
            >
              {plan.badge && (
                <span className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-[11px] font-bold ${plan.badge_color ?? ''}`}>
                  {plan.badge}
                </span>
              )}
              <h3 className="text-lg font-bold text-primary mt-1">{plan.name}</h3>
              <p className="text-sm text-muted mt-1">{plan.description}</p>
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
                className={`mt-8 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition ${plan.cta_style}`}
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
