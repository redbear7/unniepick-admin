-- stores 테이블에 image_url 컬럼 추가
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS image_url TEXT;
