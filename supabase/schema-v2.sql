-- ============================================================
-- schema-v2.sql  |  PRD 기반 DB 스키마 확장 + 더미 데이터 시딩
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. moving_companies  (이사 업체)
-- ────────────────────────────────────────────────────────────
create table if not exists moving_companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  region       text not null,           -- 서울, 경기, 인천
  rating       numeric(2,1) not null default 4.0 check (rating between 1.0 and 5.0),
  vehicle_count int not null default 1,
  staff_count  int not null default 2,
  phone        text not null,
  created_at   timestamptz not null default now()
);

alter table moving_companies enable row level security;

create policy "public read moving_companies" on moving_companies
  for select using (true);

create policy "anon insert moving_companies" on moving_companies
  for insert with check (true);


-- ────────────────────────────────────────────────────────────
-- 2. moving_requests  (이사 견적 요청)
-- ────────────────────────────────────────────────────────────
create table if not exists moving_requests (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,           -- 가정이사, 원룸이사, 사무실이사 등
  from_address text not null,
  to_address   text not null,
  move_date    date not null,
  items        jsonb not null default '[]',
  status       text not null default 'pending' check (status in ('pending','matched','completed','cancelled')),
  user_name    text,
  user_phone   text,
  created_at   timestamptz not null default now()
);

alter table moving_requests enable row level security;

create policy "public read moving_requests" on moving_requests
  for select using (true);

create policy "anon insert moving_requests" on moving_requests
  for insert with check (true);


-- ────────────────────────────────────────────────────────────
-- 3. clean_requests  (청소 상담 요청)
-- ────────────────────────────────────────────────────────────
create table if not exists clean_requests (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,            -- 입주청소, 일반청소, 이사청소 등
  area_sqm    numeric not null,         -- 평수
  clean_date  date not null,
  status      text not null default 'pending' check (status in ('pending','matched','completed','cancelled')),
  user_name   text,
  user_phone  text,
  created_at  timestamptz not null default now()
);

alter table clean_requests enable row level security;

create policy "public read clean_requests" on clean_requests
  for select using (true);

create policy "anon insert clean_requests" on clean_requests
  for insert with check (true);


-- ────────────────────────────────────────────────────────────
-- 4. aircon_requests  (에어컨 상담 요청)
-- ────────────────────────────────────────────────────────────
create table if not exists aircon_requests (
  id             uuid primary key default gen_random_uuid(),
  type           text not null,         -- 설치, 청소, 이전 등
  unit_count     int not null default 1,
  status         text not null default 'pending' check (status in ('pending','matched','completed','cancelled')),
  user_name      text,
  user_phone     text,
  preferred_date date,
  location       text,
  address        text,
  memo           text,
  created_at     timestamptz not null default now()
);

alter table aircon_requests enable row level security;

create policy "public read aircon_requests" on aircon_requests
  for select using (true);

create policy "anon insert aircon_requests" on aircon_requests
  for insert with check (true);


-- ────────────────────────────────────────────────────────────
-- 5. reviews  (고객 후기)
-- ────────────────────────────────────────────────────────────
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  service_type  text not null,          -- moving, clean, internet, aircon
  company_id    uuid,
  company_name  text not null,
  rating        int not null check (rating between 1 and 5),
  content       text,
  tags          text[] not null default '{}',
  review_date   date not null default current_date,
  created_at    timestamptz not null default now()
);

alter table reviews enable row level security;

create policy "public read reviews" on reviews
  for select using (true);

create policy "anon insert reviews" on reviews
  for insert with check (true);


-- ────────────────────────────────────────────────────────────
-- 6. banners  (프로모 배너)
-- ────────────────────────────────────────────────────────────
create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  link_url    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table banners enable row level security;

create policy "public read banners" on banners
  for select using (true);


-- ============================================================
-- 더미 데이터
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 이사 업체 50개  (서울 20개, 경기 20개, 인천 10개)
-- ────────────────────────────────────────────────────────────
insert into moving_companies (name, region, rating, vehicle_count, staff_count, phone) values
-- 서울 (20)
('서울이삿짐센터',   '서울', 4.7, 5, 10, '02-1234-5678'),
('한국이사센터',     '서울', 4.8, 6,  8, '02-2345-6789'),
('믿음이사',         '서울', 4.5, 3,  6, '02-3456-7890'),
('빠른이사',         '서울', 4.2, 4,  8, '02-4567-8901'),
('24시이사',         '서울', 4.6, 5,  9, '02-5678-9012'),
('강남이삿짐',       '서울', 4.9, 7, 12, '02-6789-0123'),
('안전이사',         '서울', 4.4, 4,  7, '02-7890-1234'),
('편안이사',         '서울', 4.3, 3,  6, '02-8901-2345'),
('서울특급이사',     '서울', 4.7, 6, 10, '02-9012-3456'),
('스피드이사',       '서울', 4.1, 3,  5, '02-0123-4567'),
('전문이사센터',     '서울', 4.8, 5,  9, '02-1111-2222'),
('나라이사',         '서울', 4.5, 4,  7, '02-2222-3333'),
('대한이삿짐',       '서울', 4.6, 5,  8, '02-3333-4444'),
('최고이사',         '서울', 4.3, 3,  6, '02-4444-5555'),
('명품이사',         '서울', 4.9, 8, 14, '02-5555-6666'),
('수도이사',         '서울', 4.2, 4,  7, '02-6666-7777'),
('으뜸이사',         '서울', 4.7, 6, 11, '02-7777-8888'),
('행복이사',         '서울', 4.4, 4,  8, '02-8888-9999'),
('프리미엄이사',     '서울', 4.8, 7, 13, '02-9999-0000'),
('두리이사',         '서울', 4.5, 5,  9, '02-1010-2020'),

-- 경기 (20)
('경기이삿짐센터',   '경기', 4.6, 5,  9, '031-1234-5678'),
('수원이사',         '경기', 4.7, 6, 10, '031-2345-6789'),
('성남이사센터',     '경기', 4.5, 4,  8, '031-3456-7890'),
('고양이삿짐',       '경기', 4.4, 4,  7, '031-4567-8901'),
('부천이사',         '경기', 4.8, 7, 12, '031-5678-9012'),
('의정부이사',       '경기', 4.3, 3,  6, '031-6789-0123'),
('안양이삿짐',       '경기', 4.6, 5, 10, '031-7890-1234'),
('평택이사센터',     '경기', 4.2, 4,  7, '031-8901-2345'),
('용인이사',         '경기', 4.7, 6, 11, '031-9012-3456'),
('광명이삿짐',       '경기', 4.5, 4,  8, '031-0123-4567'),
('파주이사',         '경기', 4.4, 3,  6, '031-1111-2222'),
('시흥이삿짐',       '경기', 4.6, 5,  9, '031-2222-3333'),
('남양주이사',       '경기', 4.3, 4,  7, '031-3333-4444'),
('화성이사센터',     '경기', 4.7, 6, 10, '031-4444-5555'),
('군포이삿짐',       '경기', 4.5, 4,  8, '031-5555-6666'),
('이천이사',         '경기', 4.8, 5,  9, '031-6666-7777'),
('오산이삿짐',       '경기', 4.2, 3,  5, '031-7777-8888'),
('하남이사',         '경기', 4.6, 5,  9, '031-8888-9999'),
('양주이삿짐',       '경기', 4.4, 4,  7, '031-9999-0000'),
('경기으뜸이사',     '경기', 4.7, 6, 11, '031-1010-2020'),

-- 인천 (10)
('인천이삿짐센터',   '인천', 4.7, 6, 10, '032-1234-5678'),
('부평이사',         '인천', 4.5, 4,  8, '032-2345-6789'),
('남동이삿짐',       '인천', 4.6, 5,  9, '032-3456-7890'),
('서구이사센터',     '인천', 4.4, 4,  7, '032-4567-8901'),
('연수이사',         '인천', 4.8, 7, 12, '032-5678-9012'),
('미추홀이삿짐',     '인천', 4.3, 3,  6, '032-6789-0123'),
('계양이사',         '인천', 4.6, 5, 10, '032-7890-1234'),
('인천특급이사',     '인천', 4.7, 6, 11, '032-8901-2345'),
('동구이삿짐',       '인천', 4.5, 4,  8, '032-9012-3456'),
('인천으뜸이사',     '인천', 4.9, 7, 13, '032-0123-4567');


-- ────────────────────────────────────────────────────────────
-- 고객 리뷰 20개  (이사 5, 청소 5, 인터넷 5, 에어컨 5)
-- ────────────────────────────────────────────────────────────
insert into reviews (service_type, company_name, rating, content, tags, review_date) values
-- 이사 (5)
('moving', '한국이사센터',     5, '친절하고 빠른 이사였어요. 짐도 하나도 안 부서지고 완벽했습니다.',         array['친절함','신속함','안전함'],  '2026-03-15'),
('moving', '서울이삿짐센터',   4, '가격 대비 만족스러운 서비스였습니다. 시간도 잘 지켜줬어요.',             array['가성비','시간엄수'],          '2026-03-18'),
('moving', '믿음이사',         5, '포장을 정말 꼼꼼하게 해주셔서 귀중품도 걱정 없었어요.',                   array['꼼꼼함','전문성'],            '2026-03-22'),
('moving', '빠른이사',         3, '전반적으로 무난했지만 대형 가구 이동 시 흠집이 약간 생겼습니다.',         array['무난함'],                     '2026-03-25'),
('moving', '강남이삿짐',       5, '명품 이사 서비스! 가구 하나하나 정성껏 포장해줘서 감동받았습니다.',       array['친절함','꼼꼼함','안전함'],   '2026-04-02'),

-- 청소 (5)
('clean',  '클린하우스',       5, '입주 청소 후 집이 완전 새집처럼 됐어요. 정말 꼼꼼하게 해주셨습니다.',    array['꼼꼼함','친절함'],            '2026-03-10'),
('clean',  '반짝청소',         4, '화장실이랑 주방 기름때를 싹 제거해줬어요. 만족스럽습니다.',               array['전문성','깔끔함'],            '2026-03-14'),
('clean',  '프로청소',         5, '이사 전 청소 맡겼는데 기대 이상이었습니다. 다음에도 이용할게요.',         array['신속함','친절함'],            '2026-03-20'),
('clean',  '홈클리닝',         4, '가격도 적당하고 서비스도 좋았어요. 재방문 의사 있습니다.',                 array['가성비','깔끔함'],            '2026-03-28'),
('clean',  '스마트청소',       3, '청소 품질은 무난했는데 약속 시간보다 30분 늦게 왔어요.',                   array['무난함'],                     '2026-04-05'),

-- 인터넷 (5)
('internet', 'KT',             5, '설치 기사님이 친절하게 설명해주시고 빠르게 설치해주셨어요.',               array['친절함','신속함'],            '2026-03-08'),
('internet', 'SKT',            4, '속도가 안정적이고 고객 서비스도 좋습니다.',                                array['안정성','친절함'],            '2026-03-12'),
('internet', 'LGU+',           5, '이전 설치 깔끔하게 해줬어요. 인터넷 속도도 만족합니다.',                   array['전문성','깔끔함'],            '2026-03-19'),
('internet', 'KT',             4, '가격 대비 속도 만족. 설치도 하루 만에 완료.',                               array['가성비','신속함'],            '2026-04-01'),
('internet', 'SKT',            3, '속도는 좋지만 요금이 조금 비싼 편이에요.',                                  array['무난함'],                     '2026-04-07'),

-- 에어컨 (5)
('aircon', '삼성서비스센터',   5, '에어컨 설치가 깔끔하고 작동 설명도 친절하게 해주셨어요.',                 array['친절함','전문성'],            '2026-03-05'),
('aircon', 'LG전자서비스',     5, '에어컨 청소 후 냄새도 없어지고 냉방 효율이 훨씬 좋아졌어요.',             array['전문성','꼼꼼함'],            '2026-03-17'),
('aircon', '쿨에어텍',         4, '설치 시간이 빠르고 마무리 정리도 잘 해줬습니다.',                           array['신속함','깔끔함'],            '2026-03-24'),
('aircon', '에어클린',         4, '에어컨 청소 서비스 좋았어요. 가격도 합리적.',                               array['가성비','친절함'],            '2026-04-03'),
('aircon', '아이스쿨',         3, '작업은 잘 됐는데 청소 후 잔여물이 조금 남아있었어요.',                     array['무난함'],                     '2026-04-09');


-- ────────────────────────────────────────────────────────────
-- 배너 3개
-- ────────────────────────────────────────────────────────────
insert into banners (text, link_url, sort_order) values
('이사 견적 최대 30% 할인! 지금 바로 무료 견적받기',  '/moving',  1),
('입주청소 특가 이벤트 진행 중 — 평당 최저가 보장',    '/clean',   2),
('에어컨 설치·청소 봄맞이 프로모션',                    '/aircon',  3);
