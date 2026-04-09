-- 통신사 / 요금제 / 상담 스키마
-- providers: KT, LG U+, SK 통신사 정보
-- plans: 각 통신사의 요금제 목록
-- consultations: 고객 상담 기록

-- -------------------------------------------------------
-- 1. providers (통신사)
-- -------------------------------------------------------
create table if not exists providers (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,         -- 'KT', 'LG U+', 'SK'
  logo_url   text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------
-- 2. plans (요금제)
-- -------------------------------------------------------
create table if not exists plans (
  id              uuid        primary key default gen_random_uuid(),
  provider_id     uuid        not null references providers(id) on delete cascade,
  name            text        not null,
  monthly_fee     integer     not null,           -- 월 요금 (원)
  data_gb         integer,                        -- 기본 데이터 (GB), null = 무제한
  voice_minutes   integer,                        -- 통화 (분), null = 무제한
  sms_count       integer,                        -- 문자 (건), null = 무제한
  description     text        default '',
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------
-- 3. consultations (상담)
-- -------------------------------------------------------
create table if not exists consultations (
  id            uuid        primary key default gen_random_uuid(),
  store_id      text        references stores(id) on delete set null,
  plan_id       uuid        references plans(id) on delete set null,
  customer_name text        not null,
  phone         text,
  status        text        not null default 'pending'
                            check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  note          text        default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -------------------------------------------------------
-- 4. 통신사 시딩
-- -------------------------------------------------------
insert into providers (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'KT'),
  ('a0000000-0000-0000-0000-000000000002', 'LG U+'),
  ('a0000000-0000-0000-0000-000000000003', 'SK')
on conflict (name) do nothing;

-- -------------------------------------------------------
-- 5. 요금제 시딩 (통신사별 3-4개, 총 10개)
-- -------------------------------------------------------
insert into plans (id, provider_id, name, monthly_fee, data_gb, voice_minutes, sms_count, description) values
  -- KT (4개)
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'KT 5G 슬림', 55000, 30, null, null, 'KT 5G 입문형 요금제 (30GB 소진 후 1Mbps)'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'KT 5G 베이직', 69000, null, null, null, 'KT 5G 데이터 완전무제한'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'KT LTE 세이브', 39000, 10, 200, 200, 'KT LTE 알뜰형 (10GB + 200분 + 200건)'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
   'KT 시니어 플랜', 29000, 5, null, null, '어르신 전용 KT 요금제 (5GB + 음성 무제한)'),

  -- LG U+ (3개)
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002',
   'U+ 5G 라이트', 52000, 25, null, null, 'LG U+ 5G 시작 요금제 (25GB 소진 후 5Mbps)'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002',
   'U+ 5G 스탠다드', 65000, null, null, null, 'LG U+ 5G 데이터 무제한'),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002',
   'U+ LTE 슬림', 37000, 8, 100, 100, 'LG U+ LTE 기본형 (8GB + 100분 + 100건)'),

  -- SK (3개)
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003',
   'SK 5G 에센스', 56000, 35, null, null, 'SK 5G 기본형 요금제 (35GB 소진 후 5Mbps)'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003',
   'SK 5G 프리미엄', 75000, null, null, null, 'SK 5G 데이터·음성 완전무제한 + 부가혜택'),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003',
   'SK LTE 베이직', 42000, 12, 200, null, 'SK LTE 중형 요금제 (12GB + 200분 + 문자 무제한)')
on conflict do nothing;

-- -------------------------------------------------------
-- 6. RLS 정책
-- -------------------------------------------------------

-- providers
alter table providers enable row level security;

create policy "providers_select_all"
  on providers for select
  using (true);

create policy "providers_insert_admin"
  on providers for insert
  with check (auth.role() = 'authenticated');

create policy "providers_update_admin"
  on providers for update
  using (auth.role() = 'authenticated');

create policy "providers_delete_admin"
  on providers for delete
  using (auth.role() = 'authenticated');

-- plans
alter table plans enable row level security;

create policy "plans_select_all"
  on plans for select
  using (true);

create policy "plans_insert_admin"
  on plans for insert
  with check (auth.role() = 'authenticated');

create policy "plans_update_admin"
  on plans for update
  using (auth.role() = 'authenticated');

create policy "plans_delete_admin"
  on plans for delete
  using (auth.role() = 'authenticated');

-- consultations
alter table consultations enable row level security;

create policy "consultations_select_admin"
  on consultations for select
  using (auth.role() = 'authenticated');

create policy "consultations_insert_admin"
  on consultations for insert
  with check (auth.role() = 'authenticated');

create policy "consultations_update_admin"
  on consultations for update
  using (auth.role() = 'authenticated');

create policy "consultations_delete_admin"
  on consultations for delete
  using (auth.role() = 'authenticated');
