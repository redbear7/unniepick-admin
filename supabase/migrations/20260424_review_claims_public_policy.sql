-- ============================================================
-- review_claims: 승인된 리뷰 공개 읽기 정책 추가
-- 승인된 리뷰는 모든 인증 사용자가 조회 가능 (스크린샷은 앱에서 본인만 표시)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'review_claims'
    AND policyname = 'approved reviews public read'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "approved reviews public read"
      ON public.review_claims FOR SELECT
      TO authenticated
      USING (status = 'approved')
    $p$;
  END IF;
END $$;
