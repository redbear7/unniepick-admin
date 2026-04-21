-- ============================================================
-- stamp_cards, follows, user_coupons 등의 user_id FK를
-- public.users → auth.users 로 변경
-- (폰 OTP 유저는 public.users에 없고 auth.users에만 존재)
-- ============================================================

-- ── stamp_cards ──────────────────────────────────────────────
ALTER TABLE stamp_cards
  DROP CONSTRAINT IF EXISTS stamp_cards_user_id_fkey;

ALTER TABLE stamp_cards
  ADD CONSTRAINT stamp_cards_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ── stamp_history (있는 경우) ─────────────────────────────────
ALTER TABLE stamp_history
  DROP CONSTRAINT IF EXISTS stamp_history_user_id_fkey;

-- stamp_history는 stamp_card_id로 연결되므로 직접 FK 없을 수 있음 (무시)

-- ── follows: 테이블 없음 (스킵) ──────────────────────────────

-- ── user_coupons ──────────────────────────────────────────────
ALTER TABLE user_coupons
  DROP CONSTRAINT IF EXISTS user_coupons_user_id_fkey;

ALTER TABLE user_coupons
  ADD CONSTRAINT user_coupons_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ── push_tokens ──────────────────────────────────────────────
ALTER TABLE push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_user_id_fkey;

ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ── profiles ─────────────────────────────────────────────────
-- (이미 auth.users 참조하는 경우가 많지만 확인 차 추가)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
