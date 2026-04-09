-- 요금제 테이블
create table if not exists plans (
  id          uuid        default gen_random_uuid() primary key,
  provider    text        not null default 'unniepick',
  plan_type   text        not null,
  name        text        not null,
  price       text        not null,
  period      text        not null default '/월',
  description text        not null default '',
  badge       text,
  badge_color text,
  features    jsonb       not null default '[]',
  cta         text        not null default '시작하기',
  cta_style   text        not null default '',
  is_popular  boolean     not null default false,
  sort_order  int         not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists plans_provider_active on plans (provider, is_active, sort_order);

-- 초기 데이터 (랜딩 페이지 PLANS 하드코딩 값)
insert into plans (provider, plan_type, name, price, period, description, badge, badge_color, features, cta, cta_style, is_popular, sort_order) values
  (
    'unniepick', 'starter', '스타터', '₩0', '/월', '시작하는 매장을 위한 플랜',
    '오픈 기념 무료', 'bg-emerald-500/15 text-emerald-400',
    '["BGM 플레이리스트 5개","AI 음성안내 기본 템플릿","쿠폰 발행 월 10건","공지사항 수신","이메일 지원"]',
    '무료로 시작하기', 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main',
    false, 1
  ),
  (
    'unniepick', 'pro', '프로', '₩19,900', '/월', '성장하는 매장의 필수 플랜',
    '가장 인기', 'bg-[#FF6F0F] text-white',
    '["무제한 플레이리스트","AI 음성안내 커스텀 TTS","AI 자동 큐레이션","숏폼 영상 월 10개 생성","AI 카드뉴스 생성","쿠폰 무제한 발행","우선 채팅 지원"]',
    '프로 시작하기', 'bg-[#FF6F0F] text-white hover:bg-[#e66000]',
    true, 2
  ),
  (
    'unniepick', 'premium', '프리미엄', '₩39,900', '/월', '다매장 운영자를 위한 플랜',
    null, null,
    '["프로의 모든 기능","숏폼 영상 무제한 생성","다국어 AI 음성안내","매장 5개까지 통합 관리","고급 매출 분석 리포트","전담 매니저 배정","API 연동 지원"]',
    '프리미엄 시작하기', 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main',
    false, 3
  )
on conflict do nothing;
