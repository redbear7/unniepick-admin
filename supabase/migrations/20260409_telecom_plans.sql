-- 통신사 / 요금제 스키마
-- providers: KT, LG U+, SK 통신사 정보
-- plans 테이블은 20260409_plans.sql 에서 생성됨 (provider text, plan_type text 기반)

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
-- 2. 통신사 시딩
-- -------------------------------------------------------
insert into providers (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'KT'),
  ('a0000000-0000-0000-0000-000000000002', 'LG U+'),
  ('a0000000-0000-0000-0000-000000000003', 'SK')
on conflict (name) do nothing;

-- -------------------------------------------------------
-- 3. 요금제 시딩 — 통신사 요금제를 plans 테이블(unified)에 삽입
-- -------------------------------------------------------
insert into plans (provider, plan_type, name, price, period, description, features, cta, cta_style, is_popular, sort_order) values
  -- KT (4개)
  ('KT', '5g', 'KT 5G 슬림', '₩55,000', '/월', 'KT 5G 입문형 요금제',
   '["데이터 30GB (소진 후 1Mbps)","음성·문자 무제한"]',
   '요금제 상담', 'bg-[#CC0000] text-white hover:bg-[#aa0000]', false, 1),

  ('KT', '5g', 'KT 5G 베이직', '₩69,000', '/월', 'KT 5G 데이터 완전무제한',
   '["데이터 완전 무제한","음성·문자 무제한"]',
   '요금제 상담', 'bg-[#CC0000] text-white hover:bg-[#aa0000]', true, 2),

  ('KT', 'lte', 'KT LTE 세이브', '₩39,000', '/월', 'KT LTE 알뜰형',
   '["데이터 10GB","음성 200분","문자 200건"]',
   '요금제 상담', 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main', false, 3),

  ('KT', 'lte', 'KT 시니어 플랜', '₩29,000', '/월', '어르신 전용 KT 요금제',
   '["데이터 5GB","음성 무제한"]',
   '요금제 상담', 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main', false, 4),

  -- LG U+ (3개)
  ('LG U+', '5g', 'U+ 5G 라이트', '₩52,000', '/월', 'LG U+ 5G 시작 요금제',
   '["데이터 25GB (소진 후 5Mbps)","음성·문자 무제한"]',
   '요금제 상담', 'bg-[#E60073] text-white hover:bg-[#c00060]', false, 1),

  ('LG U+', '5g', 'U+ 5G 스탠다드', '₩65,000', '/월', 'LG U+ 5G 데이터 무제한',
   '["데이터 무제한","음성·문자 무제한"]',
   '요금제 상담', 'bg-[#E60073] text-white hover:bg-[#c00060]', true, 2),

  ('LG U+', 'lte', 'U+ LTE 슬림', '₩37,000', '/월', 'LG U+ LTE 기본형',
   '["데이터 8GB","음성 100분","문자 100건"]',
   '요금제 상담', 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main', false, 3),

  -- SK (3개)
  ('SK', '5g', 'SK 5G 에센스', '₩56,000', '/월', 'SK 5G 기본형 요금제',
   '["데이터 35GB (소진 후 5Mbps)","음성·문자 무제한"]',
   '요금제 상담', 'bg-[#FF6600] text-white hover:bg-[#e05500]', false, 1),

  ('SK', '5g', 'SK 5G 프리미엄', '₩75,000', '/월', 'SK 5G 데이터·음성 완전무제한 + 부가혜택',
   '["데이터 완전 무제한","음성·문자 무제한","부가혜택 제공"]',
   '요금제 상담', 'bg-[#FF6600] text-white hover:bg-[#e05500]', true, 2),

  ('SK', 'lte', 'SK LTE 베이직', '₩42,000', '/월', 'SK LTE 중형 요금제',
   '["데이터 12GB","음성 200분","문자 무제한"]',
   '요금제 상담', 'bg-fill-subtle text-primary hover:bg-fill-medium border border-border-main', false, 3)

on conflict do nothing;

-- -------------------------------------------------------
-- 4. RLS 정책
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
