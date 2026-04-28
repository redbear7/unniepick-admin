-- 도로명 주소 컬럼 추가 (기존 address는 지번 주소로 사용)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS road_address TEXT;

COMMENT ON COLUMN restaurants.address      IS '지번 주소 (동 포함, 동 필터 기준)';
COMMENT ON COLUMN restaurants.road_address IS '도로명 주소';
