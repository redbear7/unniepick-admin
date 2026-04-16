-- 창원 맛집 크롤링 데이터 저장 테이블 (다중 소스 + 리뷰 분석)
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
  -- 리뷰 분석
  review_keywords JSONB DEFAULT '[]',   -- [{"keyword":"음식이 맛있어요","count":229}, ...]
  menu_keywords JSONB DEFAULT '[]',     -- [{"menu":"오징어","count":38}, ...]
  review_summary JSONB DEFAULT '{}',    -- {"맛":169,"만족도":135,"서비스":34, ...}
  blog_reviews JSONB DEFAULT '[]',      -- [{"title":"..","snippet":"..","date":".."},...]
  -- 메타
  naver_verified BOOLEAN DEFAULT false,
  is_new_open BOOLEAN DEFAULT false,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  crawled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_category ON restaurants(category);
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_crawled ON restaurants(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_restaurants_new_open ON restaurants(is_new_open) WHERE is_new_open = true;
