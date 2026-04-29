-- discovery_score: 언니픽 노출 우선순위 점수
-- 파트너(쿠폰) > 파트너 > 블로그리뷰 > AI요약 > 이미지 > 메뉴 > 전화번호 > 신규오픈 > 최근수집
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS discovery_score INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_restaurants_discovery_score ON restaurants(discovery_score DESC);
