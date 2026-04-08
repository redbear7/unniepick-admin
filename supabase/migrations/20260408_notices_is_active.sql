-- notices 테이블에 노출 여부 컬럼 추가
alter table public.notices
  add column if not exists is_active boolean not null default true;
