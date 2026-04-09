create table if not exists consultations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null,
  email        text,
  type         text not null default 'general' check (type in ('general', 'store_register', 'service', 'other')),
  content      text not null,
  status       text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table consultations enable row level security;

create policy "service_role full access" on consultations
  for all using (true);
