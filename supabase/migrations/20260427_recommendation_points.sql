-- =====================================================
-- 추천맛집 포인트 시스템
-- 실행: Supabase Dashboard → SQL Editor
-- =====================================================

-- 포인트 내역 테이블
create table if not exists public.user_points (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  points       integer     not null,
  reason       text,
  reference_id uuid,       -- 관련 추천 ID
  created_at   timestamptz default now() not null
);

alter table public.user_points enable row level security;

-- 본인 포인트만 조회 가능
create policy "points_select_own" on public.user_points
  for select using (auth.uid() = user_id);

create index if not exists idx_user_points_uid
  on public.user_points(user_id, created_at desc);

-- =====================================================
-- Supabase Storage 버킷 (Dashboard에서 직접 생성 필요)
-- =====================================================
-- 버킷명: rec-images
-- Public: ON (공개 읽기)
-- 아래 RLS 정책은 버킷 생성 후 SQL Editor에서 실행
-- =====================================================

insert into storage.buckets (id, name, public)
values ('rec-images', 'rec-images', true)
on conflict (id) do nothing;

create policy "rec_images_upload" on storage.objects
  for insert with check (
    bucket_id = 'rec-images' and auth.role() = 'authenticated'
  );

create policy "rec_images_read" on storage.objects
  for select using (bucket_id = 'rec-images');
