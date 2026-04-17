-- 크롤링 키워드 관리 테이블
CREATE TABLE IF NOT EXISTS crawl_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  is_daily BOOLEAN DEFAULT false,              -- 매일 자동 크롤링 포함
  analyze_reviews BOOLEAN DEFAULT false,        -- 리뷰/블로그 리뷰 상세 분석
  status TEXT DEFAULT 'idle',                   -- idle | running | success | failed
  last_error TEXT,
  last_result_count INTEGER,
  last_new_count INTEGER,
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 기본 키워드 (기존 하드코딩 마이그레이션)
INSERT INTO crawl_keywords (keyword, description, is_daily, analyze_reviews) VALUES
  ('창원시 새로오픈 맛집', '매일 자동 수집되는 신규 오픈 맛집', true, true)
ON CONFLICT (keyword) DO NOTHING;

-- RLS
ALTER TABLE crawl_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read crawl_keywords" ON crawl_keywords
  FOR SELECT USING (true);
