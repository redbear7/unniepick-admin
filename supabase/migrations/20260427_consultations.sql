-- ============================================================
-- 창원언니쓰 업체 상담 관리
-- 상담 신청 → 채팅 → 언니픽 가게 등록 유도
-- ============================================================

-- 1. 상담 신청 테이블
create table if not exists consult_inquiries (
  id            uuid primary key default gen_random_uuid(),
  token         text unique not null default encode(gen_random_bytes(16), 'hex'),
  owner_name    text,
  phone         text,
  business_name text not null,
  area          text,
  has_agency    boolean not null default false,
  agency_name   text,
  memo          text,
  status        text not null default 'pending'
                  check (status in ('pending', 'chatting', 'completed', 'converted')),
  -- 가게 등록 전환 시 store_applications.id 참조
  application_id uuid,
  unread_count   int not null default 0,
  last_message_at timestamptz,
  created_at    timestamptz not null default now()
);

-- 2. 상담 메시지 테이블
create table if not exists consult_messages (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references consult_inquiries(id) on delete cascade,
  sender_type text not null check (sender_type in ('admin', 'business', 'system')),
  content     text,
  file_url    text,
  file_type   text,
  file_name   text,
  created_at  timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_consult_inquiries_token on consult_inquiries(token);
create index if not exists idx_consult_inquiries_status on consult_inquiries(status);
create index if not exists idx_consult_inquiries_last_message on consult_inquiries(last_message_at desc);
create index if not exists idx_consult_messages_inquiry_id on consult_messages(inquiry_id);

-- RLS
alter table consult_inquiries enable row level security;
alter table consult_messages enable row level security;

-- anon: token으로 자신의 상담만 조회 및 메시지 전송
create policy "anon_consult_inquiries_insert" on consult_inquiries
  for insert to anon with check (true);

create policy "anon_consult_inquiries_select_by_token" on consult_inquiries
  for select to anon using (true);

create policy "anon_consult_messages_insert" on consult_messages
  for insert to anon with check (true);

create policy "anon_consult_messages_select" on consult_messages
  for select to anon using (true);

-- service_role: 전체 접근
create policy "service_consult_inquiries_all" on consult_inquiries
  for all to service_role using (true) with check (true);

create policy "service_consult_messages_all" on consult_messages
  for all to service_role using (true) with check (true);
