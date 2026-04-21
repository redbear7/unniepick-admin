-- stores 테이블에 subscription_expires_at 컬럼 추가
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
