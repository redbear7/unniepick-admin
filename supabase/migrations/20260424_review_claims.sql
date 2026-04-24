-- ============================================================
-- review_claims: 네이버 리뷰 인증 쿠폰 신청 테이블
-- 사용자가 네이버 영수증 리뷰 스크린샷을 업로드하면
-- 어드민이 승인 → 쿠폰 자동 발급
-- ============================================================

CREATE TABLE IF NOT EXISTS public.review_claims (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id        UUID        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  coupon_id       UUID        REFERENCES public.coupons(id) ON DELETE SET NULL,
  screenshot_url  TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note      TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS review_claims_store_id_idx  ON public.review_claims (store_id);
CREATE INDEX IF NOT EXISTS review_claims_user_id_idx   ON public.review_claims (user_id);
CREATE INDEX IF NOT EXISTS review_claims_status_idx    ON public.review_claims (status);

-- 1인 1가게 중복 신청 방지 (pending/approved 상태)
-- (심사중이거나 승인된 건이 있으면 같은 가게 재신청 불가)
CREATE UNIQUE INDEX IF NOT EXISTS review_claims_user_store_active_idx
  ON public.review_claims (user_id, store_id)
  WHERE status IN ('pending', 'approved');

-- RLS
ALTER TABLE public.review_claims ENABLE ROW LEVEL SECURITY;

-- service_role 전체 허용
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='review_claims' AND policyname='service role full access') THEN
    EXECUTE 'CREATE POLICY "service role full access" ON public.review_claims FOR ALL USING (true)';
  END IF;
END $$;

-- 본인 데이터 조회/삽입 허용
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='review_claims' AND policyname='user own select') THEN
    EXECUTE 'CREATE POLICY "user own select" ON public.review_claims FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='review_claims' AND policyname='user own insert') THEN
    EXECUTE 'CREATE POLICY "user own insert" ON public.review_claims FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- review_screenshots 스토리지 버킷 (없으면 생성)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-screenshots',
  'review-screenshots',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- 스토리지 정책: storage.objects RLS 정책으로 설정
DO $$ BEGIN
  -- 로그인 유저 업로드 허용
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'review screenshots upload'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "review screenshots upload"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'review-screenshots')
    $policy$;
  END IF;

  -- 퍼블릭 조회 허용 (public 버킷이므로 anon 포함)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'review screenshots public read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "review screenshots public read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'review-screenshots')
    $policy$;
  END IF;
END $$;
