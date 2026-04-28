-- restaurants AI 특징 요약 컬럼 추가
alter table public.restaurants
  add column if not exists ai_summary       text,
  add column if not exists ai_features      jsonb,
  add column if not exists ai_summary_at    timestamptz;

-- stores 테이블에도 동기화용 컬럼 추가
alter table public.stores
  add column if not exists ai_summary       text,
  add column if not exists ai_features      jsonb,
  add column if not exists ai_summary_at    timestamptz;
