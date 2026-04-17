-- 폐업 업체 추적을 위한 컬럼 추가
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS operating_status TEXT DEFAULT 'active';
-- values: active | suspected | inactive | relocated | unknown

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closure_source TEXT;
-- values: naver_404 | naver_closed_text | owner | user_report | public_data

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closure_confidence SMALLINT DEFAULT 0;
-- 0: active, 30: 1회 의심, 60: 2회 의심, 90: 3회+ / 확정 근접, 100: 확정

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspicion_count INTEGER DEFAULT 0;
-- 연속 의심 횟수

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(operating_status);
CREATE INDEX IF NOT EXISTS idx_restaurants_verified ON restaurants(last_verified_at);
