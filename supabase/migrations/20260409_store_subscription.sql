-- 가게 구독 만료일 추가
alter table stores add column if not exists subscription_expires_at timestamptz;
