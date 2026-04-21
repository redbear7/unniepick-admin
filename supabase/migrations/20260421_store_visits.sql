-- ============================================================
-- B. 방문 횟수 추적 테이블 + 함수
-- ============================================================

-- ── store_visits: 영구 방문 기록 (스탬프 리셋과 무관) ─────────
CREATE TABLE IF NOT EXISTS store_visits (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id   UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  source     TEXT        DEFAULT 'coupon_used'
               CHECK (source IN ('coupon_used', 'stamp', 'manual'))
);

CREATE INDEX IF NOT EXISTS store_visits_user_store_idx ON store_visits(user_id, store_id);
CREATE INDEX IF NOT EXISTS store_visits_store_idx      ON store_visits(store_id);

-- RLS
ALTER TABLE store_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 방문 기록 조회" ON store_visits
  FOR SELECT USING (auth.uid() = user_id);

-- ── 방문 기록 함수 (하루 1회 중복 방지) ─────────────────────
CREATE OR REPLACE FUNCTION record_store_visit(
  p_user_id  UUID,
  p_store_id UUID,
  p_source   TEXT DEFAULT 'coupon_used'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 오늘 이미 기록된 경우 스킵
  IF NOT EXISTS (
    SELECT 1 FROM store_visits
    WHERE user_id  = p_user_id
      AND store_id = p_store_id
      AND visited_at >= CURRENT_DATE
  ) THEN
    INSERT INTO store_visits(user_id, store_id, source)
    VALUES (p_user_id, p_store_id, p_source);
  END IF;
END;
$$;

-- ── 방문 횟수 조회 ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_store_visit_count(
  p_user_id  UUID,
  p_store_id UUID
)
RETURNS INT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INT
  FROM store_visits
  WHERE user_id = p_user_id AND store_id = p_store_id;
$$;

-- ── D. 쿠폰 자동 발급 함수 ────────────────────────────────────
-- 방문 기록 후 호출 → 신규·재방문 쿠폰 조건 달성 시 자동 발급
CREATE OR REPLACE FUNCTION auto_issue_coupons(
  p_user_id  UUID,
  p_store_id UUID
)
RETURNS INT  -- 발급된 쿠폰 수
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_visit_count INT;
  v_coupon      RECORD;
  v_issued      INT := 0;
BEGIN
  -- 현재 방문 횟수
  SELECT COUNT(*) INTO v_visit_count
  FROM store_visits
  WHERE user_id = p_user_id AND store_id = p_store_id;

  FOR v_coupon IN
    SELECT id, target_segment, min_visit_count
    FROM coupons
    WHERE store_id  = p_store_id
      AND is_active = TRUE
      AND expires_at > NOW()
      AND (total_quantity IS NULL OR issued_count < total_quantity)
      AND target_segment IN ('new', 'returning')
  LOOP
    -- 신규 전용: 정확히 1회 방문 시
    IF v_coupon.target_segment = 'new' AND v_visit_count = 1 THEN
      INSERT INTO user_coupons(user_id, coupon_id)
      VALUES (p_user_id, v_coupon.id)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_issued = ROW_COUNT;

    -- 재방문 전용: 정확히 min_visit_count 회 달성 시
    ELSIF v_coupon.target_segment = 'returning'
      AND v_coupon.min_visit_count IS NOT NULL
      AND v_visit_count = v_coupon.min_visit_count
    THEN
      INSERT INTO user_coupons(user_id, coupon_id)
      VALUES (p_user_id, v_coupon.id)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_issued = v_issued + ROW_COUNT;
    END IF;
  END LOOP;

  RETURN v_issued;
END;
$$;

GRANT EXECUTE ON FUNCTION record_store_visit    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_store_visit_count TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auto_issue_coupons    TO authenticated, service_role;
