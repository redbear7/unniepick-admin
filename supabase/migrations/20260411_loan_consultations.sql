-- 대출 상담 신청 테이블
create table if not exists loan_consultations (
  id             uuid primary key default gen_random_uuid(),
  user_name      text        not null,
  user_phone     text        not null,
  loan_type      text        not null,   -- 담보 | 전세 | 신용 | 사업자
  loan_amount    integer,                -- 희망 대출 금액 (만원)
  purpose        text,                   -- 대출 목적
  bank_code      text,                   -- 희망 은행 코드
  product_id     integer,               -- 희망 상품 id (dummy-loans 기준)
  memo           text,                   -- 기타 요청 사항
  status         text        not null default 'pending',  -- pending | contacted | done
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- RLS 비활성화 (관리자 전용 테이블)
alter table loan_consultations disable row level security;
