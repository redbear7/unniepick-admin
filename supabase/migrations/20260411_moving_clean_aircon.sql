-- moving_requests: 이사 견적 요청
create table if not exists moving_requests (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,                          -- 가정이사, 원룸이사, 사무실이사 등
  from_address text not null,
  to_address  text not null,
  move_date   date not null,
  items       jsonb not null default '[]',            -- 짐 목록
  status      text not null default 'pending' check (status in ('pending', 'matched', 'completed', 'cancelled')),
  user_name   text,
  user_phone  text,
  created_at  timestamptz not null default now()
);

alter table moving_requests enable row level security;

create policy "public read moving_requests" on moving_requests
  for select using (true);

create policy "anon insert moving_requests" on moving_requests
  for insert with check (true);


-- clean_requests: 청소 요청
create table if not exists clean_requests (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,                          -- 입주청소, 일반청소, 이사청소 등
  area_sqm    numeric not null,                       -- 평수
  clean_date  date not null,
  status      text not null default 'pending' check (status in ('pending', 'matched', 'completed', 'cancelled')),
  user_name   text,
  user_phone  text,
  created_at  timestamptz not null default now()
);

alter table clean_requests enable row level security;

create policy "public read clean_requests" on clean_requests
  for select using (true);

create policy "anon insert clean_requests" on clean_requests
  for insert with check (true);


-- aircon_requests: 에어컨 요청
create table if not exists aircon_requests (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,                          -- 설치, 청소, 이전 등
  unit_count  int not null default 1,                 -- 대수
  status      text not null default 'pending' check (status in ('pending', 'matched', 'completed', 'cancelled')),
  user_name   text,
  user_phone  text,
  preferred_date date,
  created_at  timestamptz not null default now()
);

alter table aircon_requests enable row level security;

create policy "public read aircon_requests" on aircon_requests
  for select using (true);

create policy "anon insert aircon_requests" on aircon_requests
  for insert with check (true);


-- reviews: 이사업체 고객 평가
create table if not exists reviews (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid,
  company_name    text not null,
  rating          int not null check (rating between 1 and 5),
  content         text,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now()
);

alter table reviews enable row level security;

create policy "public read reviews" on reviews
  for select using (true);

create policy "anon insert reviews" on reviews
  for insert with check (true);


-- banners: 프로모 배너
create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  link_url    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table banners enable row level security;

create policy "public read banners" on banners
  for select using (true);


-- 초기 리뷰 데이터 시딩 (5개)
insert into reviews (company_name, rating, content, tags) values
  ('한국이사센터', 5, '친절하고 빠른 이사였어요. 짐도 하나도 안 부서지고 완벽했습니다.', array['친절함', '신속함', '안전함']),
  ('서울이삿짐센터', 4, '가격 대비 만족스러운 서비스였습니다. 시간도 잘 지켜줬어요.', array['가성비', '시간엄수']),
  ('믿음이사', 5, '포장을 정말 꼼꼼하게 해주셔서 귀중품도 걱정 없었어요.', array['꼼꼼함', '전문성']),
  ('빠른이사', 3, '전반적으로 무난했지만 대형 가구 이동 시 흠집이 약간 생겼습니다.', array['무난함']),
  ('24시이사', 4, '야간 이사였는데도 불평 없이 열심히 해주셨어요. 추천합니다.', array['친절함', '야간가능']);
