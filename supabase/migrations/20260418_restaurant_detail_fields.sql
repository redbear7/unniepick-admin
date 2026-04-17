-- 업체 상세 정보 필드 추가
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_hours        TEXT,           -- 영업시간 요약 (예: "월·화·수·목·금 11:00~22:00")
  ADD COLUMN IF NOT EXISTS business_hours_detail TEXT,           -- 요일별 상세 JSON
  ADD COLUMN IF NOT EXISTS website_url           TEXT,           -- 홈페이지 URL
  ADD COLUMN IF NOT EXISTS instagram_url         TEXT;           -- 인스타그램 URL
