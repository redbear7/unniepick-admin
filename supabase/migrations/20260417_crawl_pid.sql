-- 크롤러 프로세스 PID 추적용 (수동 중지 기능)
ALTER TABLE crawl_keywords ADD COLUMN IF NOT EXISTS current_pid INTEGER;
