-- ============================================================
-- 가입지역 + 마지막 쿠폰 사용 위치 추적 (쿠폰 부정 사용 방지)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_address    TEXT,
  ADD COLUMN IF NOT EXISTS last_used_address TEXT,
  ADD COLUMN IF NOT EXISTS last_used_at      TIMESTAMPTZ;
