-- 업체 커스텀 태그 컬럼 추가
-- (기존 tags는 크롤링 키워드 보존, custom_tags는 어드민이 수동 관리)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS custom_tags TEXT[] DEFAULT '{}';

-- 태그 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_restaurants_custom_tags
  ON restaurants USING GIN (custom_tags);

-- review_keywords 인덱스 (태그 추출용)
CREATE INDEX IF NOT EXISTS idx_restaurants_review_keywords
  ON restaurants USING GIN (review_keywords jsonb_path_ops);
