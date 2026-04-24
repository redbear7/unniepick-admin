-- ============================================================
-- store_applications 테이블 생성 + 컬럼 추가
-- 점주 가게 등록 신청 (단계별 위저드 /apply 에서 제출)
-- ============================================================

-- 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS public.store_applications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name     TEXT        NOT NULL,
  owner_phone    TEXT        NOT NULL,
  store_name     TEXT        NOT NULL,
  category       TEXT,
  address        TEXT,
  address_detail TEXT,
  postcode       TEXT,
  phone          TEXT,
  description    TEXT,
  instagram_url  TEXT,
  naver_place_url TEXT,
  latitude       NUMERIC,
  longitude      NUMERIC,
  message        TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note     TEXT,
  reviewed_at    TIMESTAMPTZ,
  store_id       UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- coupon_draft 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.store_applications
  ADD COLUMN IF NOT EXISTS coupon_draft JSONB;

-- review_token 컬럼 추가 — 신청자가 로그인 없이 신청 내역 확인에 사용
ALTER TABLE public.store_applications
  ADD COLUMN IF NOT EXISTS review_token UUID NOT NULL DEFAULT gen_random_uuid();

-- review_token 유니크 인덱스 (토큰으로 단건 조회)
CREATE UNIQUE INDEX IF NOT EXISTS store_applications_review_token_idx
  ON public.store_applications (review_token);

-- RLS 활성화
ALTER TABLE public.store_applications ENABLE ROW LEVEL SECURITY;

-- service_role(서버사이드) 전체 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_applications'
      AND policyname = 'service role full access'
  ) THEN
    EXECUTE 'CREATE POLICY "service role full access" ON public.store_applications FOR ALL USING (true)';
  END IF;
END $$;

-- 누구나 INSERT 가능 (공개 신청 폼 — owner_id 없이도 가능)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_applications'
      AND policyname = 'public insert allowed'
  ) THEN
    EXECUTE 'CREATE POLICY "public insert allowed" ON public.store_applications FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- review_token으로 단건 조회 허용 (공개 확인 페이지용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_applications'
      AND policyname = 'public select by token'
  ) THEN
    EXECUTE 'CREATE POLICY "public select by token" ON public.store_applications FOR SELECT USING (true)';
  END IF;
END $$;
