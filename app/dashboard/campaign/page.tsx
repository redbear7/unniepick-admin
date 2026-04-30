import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Film,
  ImagePlus,
  Map,
  MapPin,
  Megaphone,
  PanelBottom,
  Radio,
  Send,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Video,
} from 'lucide-react';

const QUICK_ACTIONS = [
  {
    href: '/dashboard/shorts',
    icon: Film,
    title: '숏폼 생성',
    desc: '음악과 쿠폰을 결합해 상권별 15~20초 영상을 만듭니다.',
    accent: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    href: '/dashboard/coupons',
    icon: Ticket,
    title: '쿠폰 운영',
    desc: '만원픽, 한산딜, 첫 방문 쿠폰을 발행하고 상태를 확인합니다.',
    accent: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    href: '/dashboard/map',
    icon: Map,
    title: '상권 지도',
    desc: '쿠폰 위치, 상권별 분포, 지오펜스 반경을 지도에서 점검합니다.',
    accent: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    href: '/dashboard/push',
    icon: Bell,
    title: '푸쉬 알림',
    desc: '점심 전, 한산 시간, 오늘 마감 쿠폰을 타이밍에 맞춰 발송합니다.',
    accent: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    href: '/dashboard/banners',
    icon: PanelBottom,
    title: '앱 배너',
    desc: '홈 상단에서 창원 만원픽 캠페인을 고정 노출합니다.',
    accent: 'text-pink-400',
    bg: 'bg-pink-400/10',
  },
  {
    href: '/dashboard/ai-images',
    icon: ImagePlus,
    title: 'AI 이미지',
    desc: '숏폼 썸네일, 배너, 쿠폰 비주얼 소재를 빠르게 만듭니다.',
    accent: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
];

const DISTRICTS = [
  {
    rank: 1,
    name: '상남동',
    phase: 'V1 핵심',
    reason: '외식, 회식, 저녁 소비가 강하고 숏폼 반응을 가장 빨리 검증하기 좋습니다.',
    target: '가게 30곳 · 쿠폰 50개 · 숏폼 30편',
  },
  {
    rank: 2,
    name: '용호동·중앙동',
    phase: 'V1 후반',
    reason: '평일 점심, 카페, 직장인 푸시 캠페인에 적합합니다.',
    target: '점심 쿠폰 25개 · 배너 3개',
  },
  {
    rank: 3,
    name: '창원대 생활권',
    phase: 'V2 초반',
    reason: '가격 민감도와 제보/공유 참여를 검증하기 좋습니다.',
    target: '학생픽 숏폼 20편 · 제보 100건',
  },
];

const WEEK_PLAN = [
  ['1주차', '제로마찰 골격', '상권 칩 3개, 가격 필터 3개, 하단 고정 CTA, 쿠폰 받기 플로우'],
  ['2주차', '숏폼 캠페인 연결', '숏폼 결과를 쿠폰/상권 캠페인과 연결하고 템플릿 4종 고정'],
  ['3주차', '앱 사용 흐름 완성', '홈 추천, 숏폼 피드, 쿠폰함 QR, 실시간 활동 피드, 지오펜스 알림'],
  ['4주차', '파일럿 런칭', '상남동 가게 30곳, 쿠폰 50개, 숏폼 30편, 사장님 모집 링크 배포'],
];

const CONTENT_SERIES = [
  { title: '창원 만원 점심 15초', desc: '상남동 점심 전 저장 유도', icon: '🍱' },
  { title: '퇴근 후 사장님 응원딜', desc: '한산 시간대 방문 분산', icon: '🌙' },
  { title: '창원대 학생픽', desc: '학생 제보와 친구 공유 유도', icon: '🎒' },
  { title: '마산 창동 다시 걷기', desc: '전통상권 주말 코스화', icon: '🚶' },
];

export default function CampaignPage() {
  return (
    <div className="p-8 space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border-main bg-gradient-to-br from-[#191F28] via-[#2B303A] to-[#4A2D18] p-8 text-white">
        <div className="absolute right-8 top-6 text-8xl opacity-10">🎬</div>
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-orange-100">
            <Sparkles size={13} />
            창원 만원픽 V1 런칭 허브
          </div>
          <h1 className="text-3xl font-black leading-tight">
            10초 쿠폰, 30초 참여, 고급형 상권 캠페인
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            V1은 상남동에서 먼저 검증합니다. 사용자는 설명 없이 쿠폰을 받고, 사장님은 간단한 참여 신청만 남기고,
            운영자는 음악 쿠폰 숏폼으로 거지맵과 다른 깔끔한 상권 활성화 콘텐츠를 반복 배포합니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">가게 30곳</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">쿠폰 50개</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">숏폼 30편</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">파일럿 300명</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Ticket, label: '사용자 첫 행동', value: '10초', sub: '상권 선택 → 쿠폰 받기' },
          { icon: Users, label: '사장님 참여', value: '30초', sub: '가게명, 혜택, 사진 1장' },
          { icon: Radio, label: '라이브 신호', value: '실시간', sub: '쿠폰 저장, QR 사용, 사장님 등록' },
          { icon: MapPin, label: 'GPS 활용', value: '상권 반경', sub: '개인 좌표 대신 지오펜스' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-2xl border border-border-main bg-card p-5">
            <div className="mb-3 inline-flex rounded-xl bg-[#FF6F0F]/10 p-2">
              <Icon size={18} className="text-[#FF6F0F]" />
            </div>
            <p className="text-2xl font-black text-primary">{value}</p>
            <p className="mt-1 text-xs font-bold text-tertiary">{label}</p>
            <p className="mt-1.5 text-xs text-dim">{sub}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border-main bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-[#FF6F0F]" />
          <h2 className="text-lg font-black text-primary">접근성 운영 원칙</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['한 화면 한 행동', '홈은 쿠폰 받기, 숏폼은 저장, 지도는 길찾기, 쿠폰함은 QR 사용만 강조합니다.'],
            ['선택지는 적게', '첫 화면에는 상권 3개, 가격 3개, 추천 쿠폰 5개만 노출합니다.'],
            ['고급형 표현', '싼 집 대신 착한 구성, 사장님 인증, 한산 시간 혜택으로 브랜드를 보호합니다.'],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
              <p className="text-sm font-black text-primary">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <div className="rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Radio size={18} className="text-[#FF6F0F]" />
            <h2 className="text-lg font-black text-primary">실시간 활동 피드</h2>
          </div>
          <div className="space-y-3">
            {[
              ['쿠폰 저장', '상남동에서 청담국수 쿠폰 3명이 저장 · 2분 전'],
              ['사장님 활동', '모카팩토리 사장님이 라떼 1+1 쿠폰 등록 · 5분 전'],
              ['QR 사용', '상남백반 QR 쿠폰 사용 완료 · 8분 전'],
              ['숏폼 요청', '퇴근 후 응원딜 릴스 제작 요청 접수 · 12분 전'],
            ].map(([label, desc]) => (
              <div key={label} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-400 shadow-[0_0_0_5px_rgba(74,222,128,0.12)]" />
                  <div>
                    <p className="text-sm font-black text-primary">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-[#FF6F0F]" />
            <h2 className="text-lg font-black text-primary">지오펜스 GPS 활용</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['상권 진입', '상남동 반경 진입 시 오늘 사용 가능한 쿠폰을 노출합니다.'],
              ['가게 근처', '가게 300m 접근 시 저장한 쿠폰과 QR 사용 버튼을 띄웁니다.'],
              ['시간대 트리거', '점심 전, 퇴근 전, 한산 시간대에만 알림 피로도를 낮춰 발송합니다.'],
              ['개인정보 보호', '실시간 피드는 실명과 정확한 좌표 없이 상권 단위로만 보여줍니다.'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                <p className="text-sm font-black text-primary">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-primary">빠른 실행</h2>
            <p className="mt-1 text-sm text-muted">상권 캠페인 운영에 필요한 메뉴만 모았습니다.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_ACTIONS.map(({ href, icon: Icon, title, desc, accent, bg }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-border-main bg-card p-5 transition hover:-translate-y-0.5 hover:border-[#FF6F0F]/40 hover:bg-card-hover"
            >
              <div className="flex items-start gap-4">
                <div className={`rounded-xl p-2 ${bg}`}>
                  <Icon size={18} className={accent} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-primary">{title}</h3>
                    <ArrowRight size={14} className="text-dim transition group-hover:translate-x-1 group-hover:text-[#FF6F0F]" />
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-[#FF6F0F]" />
            <h2 className="text-lg font-black text-primary">우선 적용 상권</h2>
          </div>
          <div className="space-y-3">
            {DISTRICTS.map(district => (
              <div key={district.name} className="rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FF6F0F] text-sm font-black text-white">
                    {district.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-primary">{district.name}</h3>
                      <span className="rounded-full bg-[#FF6F0F]/10 px-2 py-0.5 text-[10px] font-bold text-[#FF6F0F]">
                        {district.phase}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted">{district.reason}</p>
                    <p className="mt-2 text-[11px] font-bold text-tertiary">{district.target}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-[#FF6F0F]" />
            <h2 className="text-lg font-black text-primary">콘텐츠 시리즈</h2>
          </div>
          <div className="grid gap-3">
            {CONTENT_SERIES.map(series => (
              <div key={series.title} className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                <div className="text-2xl">{series.icon}</div>
                <div>
                  <p className="text-sm font-black text-primary">{series.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{series.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/shorts"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#FF6F0F] px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
          >
            <Video size={16} />
            오늘 숏폼 제작하기
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-400" />
            <h2 className="text-lg font-black text-primary">V1 4주 일정</h2>
          </div>
          <div className="space-y-3">
            {WEEK_PLAN.map(([week, title, desc]) => (
              <div key={week} className="grid grid-cols-[72px_1fr] gap-3 rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                <div className="text-xs font-black text-[#FF6F0F]">{week}</div>
                <div>
                  <p className="text-sm font-black text-primary">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border-main bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Send size={18} className="text-[#FF6F0F]" />
            <h2 className="text-lg font-black text-primary">런칭 전 체크리스트</h2>
          </div>
          <div className="space-y-3">
            {[
              ['콘텐츠', '상남동 쿠폰 50개, 숏폼 30편, 앱 배너 5개'],
              ['가게', '사장님 30초 참여 신청 또는 운영자 검수 가게 30곳'],
              ['사용자', '파일럿 300명, 카카오 공유 링크, 인스타 릴스, 쿠폰 받기 CTA'],
              ['데이터', '노출, 클릭, 쿠폰 저장, QR 사용, 사장님 활동, 숏폼 요청 로그'],
              ['위치', '상권 지오펜스, 가게 300m 반경, 위치 권한 미동의 대체 흐름'],
              ['운영', '오류 신고, 가격 수정, 쿠폰 비공개 처리 플로우'],
            ].map(([label, desc]) => (
              <div key={label} className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-fill-subtle/40 p-4">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-400" />
                <div>
                  <p className="text-sm font-black text-primary">{label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
