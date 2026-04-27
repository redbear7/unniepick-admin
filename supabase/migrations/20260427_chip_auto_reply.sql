-- consult_chips 테이블에 auto_reply 컬럼 추가
ALTER TABLE consult_chips
  ADD COLUMN IF NOT EXISTS auto_reply TEXT NULL;
