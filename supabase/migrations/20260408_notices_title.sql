-- notices 테이블에 제목 컬럼 추가
alter table public.notices
  add column if not exists title text not null default '';
