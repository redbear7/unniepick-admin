-- 언니픽 카테고리 v2: 스타일(용도) + 세부분류 컬럼 추가
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS unniepick_style TEXT,   -- 용도: 술자리 | 회식·단체 | 혼밥·간편식 | 데이트·모임 | 카페·여가 | 일반식사
  ADD COLUMN IF NOT EXISTS unniepick_sub   TEXT;   -- 세부: 카카오 3뎁스 or 네이버 세부 카테고리

CREATE INDEX IF NOT EXISTS idx_restaurants_unniepick_style ON restaurants(unniepick_style);
CREATE INDEX IF NOT EXISTS idx_restaurants_unniepick_sub   ON restaurants(unniepick_sub);
