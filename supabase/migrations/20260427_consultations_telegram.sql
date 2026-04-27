-- telegram_message_id: 최초 알림 메시지 ID (웹훅 reply 라우팅용)
alter table consult_inquiries
  add column if not exists telegram_message_id bigint;

create index if not exists idx_consult_telegram_msg
  on consult_inquiries(telegram_message_id)
  where telegram_message_id is not null;
