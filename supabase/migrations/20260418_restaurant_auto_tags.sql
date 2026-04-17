-- 다차원 자동 태그 컬럼 추가
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS auto_tags JSONB DEFAULT '{}';

-- 분석용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_auto_tags
  ON restaurants USING GIN (auto_tags);

-- 코멘트
COMMENT ON COLUMN restaurants.auto_tags IS
  '다차원 자동 태그: {foodType, atmosphere, service, facilities, priceRange, mealTime, location, characteristics}';
