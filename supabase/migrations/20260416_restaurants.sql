-- 창원 신상 맛집 크롤링 데이터 저장 테이블
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  naver_place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  category TEXT,
  rating NUMERIC(2,1),
  review_count INTEGER DEFAULT 0,
  visitor_review_count INTEGER DEFAULT 0,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  image_url TEXT,
  naver_place_url TEXT,
  menu_items JSONB DEFAULT '[]',
  open_date DATE,
  tags TEXT[] DEFAULT '{}',
  crawled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_category ON restaurants(category);
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_crawled ON restaurants(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants USING gin(to_tsvector('simple', name));
