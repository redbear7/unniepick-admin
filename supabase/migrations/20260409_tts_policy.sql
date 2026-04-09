-- TTS 회원 정책 테이블
create table if not exists tts_policies (
  id               uuid    default gen_random_uuid() primary key,
  name             text    not null unique,
  daily_char_limit integer not null default 500,  -- -1 = 무제한
  description      text    default '',
  sort_order       integer not null default 0,
  created_at       timestamptz default now()
);

-- 회원 등급: 스타터 / 프로 / 프리미엄 (랜딩 요금제와 동일)
insert into tts_policies (name, daily_char_limit, description, sort_order) values
  ('스타터',   500,  '하루 500자 (기본 템플릿)',     0),
  ('프로',    3000,  '하루 3,000자 (커스텀 TTS)',    1),
  ('프리미엄',   -1,  '무제한 (다국어 AI 음성안내)',  2)
on conflict (name) do nothing;

-- stores 테이블에 정책 컬럼 추가
alter table stores add column if not exists tts_policy_id uuid references tts_policies(id);

-- TTS 일별 사용량
create table if not exists tts_daily_usage (
  id          uuid    default gen_random_uuid() primary key,
  store_id    text    not null,
  usage_date  date    not null default current_date,
  char_count  integer not null default 0,
  updated_at  timestamptz default now(),
  unique(store_id, usage_date)
);
