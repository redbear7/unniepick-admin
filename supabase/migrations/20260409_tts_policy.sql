-- TTS 회원 정책 테이블
create table if not exists tts_policies (
  id               uuid    default gen_random_uuid() primary key,
  name             text    not null unique,
  daily_char_limit integer not null default 500,  -- -1 = 무제한
  description      text    default '',
  sort_order       integer not null default 0,
  created_at       timestamptz default now()
);

insert into tts_policies (name, daily_char_limit, description, sort_order) values
  ('무료',   500,  '하루 500자',   0),
  ('베이직', 2000, '하루 2,000자', 1),
  ('프로',   5000, '하루 5,000자', 2),
  ('무제한',   -1, '제한 없음',    3)
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
