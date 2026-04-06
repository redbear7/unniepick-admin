create table if not exists store_requests (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users(id) on delete set null,
  owner_name   text not null,
  owner_phone  text,
  store_name   text not null,
  store_address text,
  store_phone  text,
  store_category text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

alter table store_requests enable row level security;

-- 슈퍼어드민만 모든 작업 허용 (service_role 또는 별도 정책 설정 필요)
create policy "superadmin full access" on store_requests
  for all using (true);
