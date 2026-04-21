-- coupons 테이블에 대상 고객 세그먼트 + 최소 방문 횟수 컬럼 추가
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS target_segment TEXT DEFAULT 'all'
    CHECK (target_segment IN ('all', 'new', 'returning')),
  ADD COLUMN IF NOT EXISTS min_visit_count INT DEFAULT NULL;

COMMENT ON COLUMN coupons.target_segment IS '대상 고객: all=전체, new=신규, returning=재방문';
COMMENT ON COLUMN coupons.min_visit_count IS '재방문 쿠폰 최소 방문 횟수 (target_segment=returning 일 때만 사용)';
