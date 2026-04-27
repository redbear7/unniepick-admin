-- =====================================================
-- 나만의 추천맛집 기능
-- 실행: Supabase Dashboard → SQL Editor
-- =====================================================

-- ① 추천 포스트
create table if not exists public.user_recommendations (
  id                  uuid        default gen_random_uuid() primary key,
  user_id             uuid        references auth.users(id) on delete cascade not null,
  user_display        text,                            -- 표시용 번호 (010-****-1234)
  place_id            text        not null,            -- kakao place ID
  place_name          text        not null,
  place_category      text,
  place_address       text,
  place_image_url     text,
  source              text        default 'kakao',
  menu_items          jsonb       default '[]'::jsonb, -- [{name,price}]
  recommendation_text text,
  like_count          integer     default 0,
  comment_count       integer     default 0,
  created_at          timestamptz default now() not null
);

-- ② 추천 좋아요
create table if not exists public.recommendation_likes (
  id                  uuid        default gen_random_uuid() primary key,
  recommendation_id   uuid        references public.user_recommendations(id) on delete cascade not null,
  user_id             uuid        references auth.users(id) on delete cascade not null,
  created_at          timestamptz default now() not null,
  unique(recommendation_id, user_id)
);

-- ③ 댓글
create table if not exists public.recommendation_comments (
  id                  uuid        default gen_random_uuid() primary key,
  recommendation_id   uuid        references public.user_recommendations(id) on delete cascade not null,
  user_id             uuid        references auth.users(id) on delete cascade not null,
  user_display        text,
  content             text        not null,
  like_count          integer     default 0,
  created_at          timestamptz default now() not null
);

-- ④ 댓글 좋아요
create table if not exists public.recommendation_comment_likes (
  id          uuid        default gen_random_uuid() primary key,
  comment_id  uuid        references public.recommendation_comments(id) on delete cascade not null,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  unique(comment_id, user_id)
);

-- ─── RLS ─────────────────────────────────────────────────────────
alter table public.user_recommendations          enable row level security;
alter table public.recommendation_likes          enable row level security;
alter table public.recommendation_comments       enable row level security;
alter table public.recommendation_comment_likes  enable row level security;

-- 추천 포스트: 누구나 읽기, 로그인 사용자만 쓰기
create policy "recommendations_read"   on public.user_recommendations for select using (true);
create policy "recommendations_insert" on public.user_recommendations for insert with check (auth.uid() = user_id);
create policy "recommendations_delete" on public.user_recommendations for delete using (auth.uid() = user_id);

-- 좋아요: 누구나 읽기, 로그인 사용자만 토글
create policy "rec_likes_read"   on public.recommendation_likes for select using (true);
create policy "rec_likes_insert" on public.recommendation_likes for insert with check (auth.uid() = user_id);
create policy "rec_likes_delete" on public.recommendation_likes for delete using (auth.uid() = user_id);

-- 댓글: 누구나 읽기, 로그인 사용자만 쓰기
create policy "comments_read"   on public.recommendation_comments for select using (true);
create policy "comments_insert" on public.recommendation_comments for insert with check (auth.uid() = user_id);
create policy "comments_delete" on public.recommendation_comments for delete using (auth.uid() = user_id);

-- 댓글 좋아요
create policy "cmt_likes_read"   on public.recommendation_comment_likes for select using (true);
create policy "cmt_likes_insert" on public.recommendation_comment_likes for insert with check (auth.uid() = user_id);
create policy "cmt_likes_delete" on public.recommendation_comment_likes for delete using (auth.uid() = user_id);

-- ─── 인덱스 ────────────────────────────────────────────────────────
create index if not exists idx_rec_created_at  on public.user_recommendations(created_at desc);
create index if not exists idx_rec_likes_rid   on public.recommendation_likes(recommendation_id);
create index if not exists idx_comments_rid    on public.recommendation_comments(recommendation_id, created_at);
create index if not exists idx_cmt_likes_cid   on public.recommendation_comment_likes(comment_id);
