-- 카카오 공식 API 수집 데이터 필드 추가
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS kakao_place_id    TEXT UNIQUE,       -- 카카오 place ID
  ADD COLUMN IF NOT EXISTS kakao_place_url   TEXT,              -- 카카오맵 URL
  ADD COLUMN IF NOT EXISTS kakao_category    TEXT,              -- 카카오 원본 카테고리 (예: 음식점 > 치킨)
  ADD COLUMN IF NOT EXISTS unniepick_category TEXT,             -- 언니픽 매핑 카테고리
  ADD COLUMN IF NOT EXISTS source            TEXT DEFAULT 'naver', -- 수집 출처: 'kakao' | 'naver' | 'manual'
  ADD COLUMN IF NOT EXISTS operating_status  TEXT DEFAULT 'unknown', -- active | suspected | inactive | unknown
  ADD COLUMN IF NOT EXISTS suspicion_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closure_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS closure_source    TEXT,
  ADD COLUMN IF NOT EXISTS closed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_at  TIMESTAMPTZ;

-- naver_place_id를 nullable로 변경 (카카오 전용 업체는 naver_place_id 없음)
ALTER TABLE restaurants ALTER COLUMN naver_place_id DROP NOT NULL;

-- 카카오 place_id 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_kakao_id ON restaurants(kakao_place_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_source ON restaurants(source);
CREATE INDEX IF NOT EXISTS idx_restaurants_unniepick_category ON restaurants(unniepick_category);
CREATE INDEX IF NOT EXISTS idx_restaurants_operating_status ON restaurants(operating_status);
