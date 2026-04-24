-- ============================================================
-- receipt_stamp_sessions: 영수증 인증 후 동반자 스탬프 공유 세션
-- 영수증 메뉴 갯수 기준으로 동반자에게 스탬프 공유
-- ============================================================

CREATE TABLE IF NOT EXISTS public.receipt_stamp_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id      UUID        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  party_code    VARCHAR(6)  NOT NULL,           -- 6자리 공유 코드
  max_joins     INT         NOT NULL DEFAULT 1, -- 동반자 최대 인원 (호스트 제외)
  joined_count  INT         NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 (활성 코드 빠른 조회)
CREATE INDEX IF NOT EXISTS receipt_stamp_sessions_code_idx
  ON public.receipt_stamp_sessions (party_code, expires_at);

-- 동반자 참가 기록
CREATE TABLE IF NOT EXISTS public.receipt_stamp_joins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES public.receipt_stamp_sessions(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stamped    BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- RLS
ALTER TABLE public.receipt_stamp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_stamp_joins    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receipt_stamp_sessions' AND policyname='service role full access') THEN
    EXECUTE 'CREATE POLICY "service role full access" ON public.receipt_stamp_sessions FOR ALL USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='receipt_stamp_joins' AND policyname='service role full access') THEN
    EXECUTE 'CREATE POLICY "service role full access" ON public.receipt_stamp_joins FOR ALL USING (true)';
  END IF;
END $$;
