-- 공지사항 테이블
create table if not exists public.notices (
  id           uuid        primary key default gen_random_uuid(),
  author_name  text        not null default '관리자',
  author_emoji text        not null default '🍖',
  content      text        not null,
  image_url    text,
  notice_type  text        not null default 'general', -- 'general' | 'important' | 'event'
  is_pinned    boolean     not null default false,
  like_count   integer     not null default 0,
  view_count   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS
alter table public.notices enable row level security;

-- 모두 읽기 가능
create policy "notices_public_read"
  on public.notices for select using (true);

-- service role 쓰기 (API route 에서 service key 사용)
create policy "notices_service_write"
  on public.notices for all
  using (true) with check (true);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notices_updated_at
  before update on public.notices
  for each row execute procedure public.set_updated_at();
