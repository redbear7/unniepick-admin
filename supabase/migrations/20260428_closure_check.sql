-- 폐업 검수 + 개업일 관련 컬럼 (IF NOT EXISTS로 안전하게)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS suspicion_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closure_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS closure_source     TEXT,
  ADD COLUMN IF NOT EXISTS closed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at          TIMESTAMPTZ; -- 행안부 인허가일자(apvPermYmd) 기반 개업일

-- 검수 효율을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_last_verified ON restaurants(last_verified_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_restaurants_suspicion     ON restaurants(suspicion_count) WHERE suspicion_count > 0;
CREATE INDEX IF NOT EXISTS idx_restaurants_opened_at     ON restaurants(opened_at) WHERE opened_at IS NOT NULL;
