-- 브레인스토밍 세션 테이블
CREATE TABLE IF NOT EXISTS brainstorm_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL DEFAULT '새 회의',
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  messages     JSONB NOT NULL DEFAULT '[]',   -- [{ role, content, ts }]
  mindmap      JSONB,                          -- 정리된 마인드맵 JSON
  core_insights TEXT[],
  next_actions  TEXT[],
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brainstorm_sessions_date_idx ON brainstorm_sessions(date DESC);
