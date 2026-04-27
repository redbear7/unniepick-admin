-- 상담 챗봇 칩 (고객용 빠른 질문)
create table if not exists consult_chips (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,          -- 칩에 보이는 짧은 텍스트
  message    text not null,          -- 전송될 실제 메시지
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- 기본 샘플 칩
insert into consult_chips (label, message, sort_order) values
  ('광고 문의',    '안녕하세요! 언니쓰 광고에 대해 문의드리고 싶어요.', 0),
  ('가격이 궁금해요', '광고 비용이 어떻게 되나요?', 1),
  ('효과가 궁금해요', '광고 효과가 어느 정도 되나요?', 2),
  ('진행 절차 문의', '광고 진행 절차가 어떻게 되나요?', 3);

-- RLS
alter table consult_chips enable row level security;
create policy "anyone_can_read_active_chips" on consult_chips
  for select using (is_active = true);
create policy "service_consult_chips_all" on consult_chips
  for all to service_role using (true) with check (true);
