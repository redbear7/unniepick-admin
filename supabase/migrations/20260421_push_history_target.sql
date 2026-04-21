-- push_history에 target 컬럼 추가 (없으면 무시)
ALTER TABLE push_history
  ADD COLUMN IF NOT EXISTS target TEXT DEFAULT 'optin' CHECK (target IN ('all', 'optin'));
