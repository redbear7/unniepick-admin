-- 이사 견적 요청
create table if not exists moving_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null,
  email        text,
  from_address text not null,
  to_address   text not null,
  moving_date  date,
  content      text,
  status       text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table moving_requests enable row level security;

create policy "service_role full access" on moving_requests
  for all using (true);

-- 청소 상담 요청
create table if not exists clean_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  email      text,
  address    text not null,
  area       text,
  content    text,
  status     text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clean_requests enable row level security;

create policy "service_role full access" on clean_requests
  for all using (true);

-- 에어컨 상담 요청
create table if not exists aircon_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  email      text,
  address    text not null,
  content    text,
  status     text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table aircon_requests enable row level security;

create policy "service_role full access" on aircon_requests
  for all using (true);

-- 고객 리뷰
create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  rating       integer not null check (rating between 1 and 5),
  content      text not null,
  service_type text not null check (service_type in ('moving', 'clean', 'aircon', 'general')),
  is_visible   boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table reviews enable row level security;

create policy "service_role full access" on reviews
  for all using (true);

-- 배너
create table if not exists banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  image_url  text not null,
  link_url   text,
  position   integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table banners enable row level security;

create policy "service_role full access" on banners
  for all using (true);
