-- ============================================================
-- 사장님 검증 V1: 사업자등록증 사진 또는 사업자번호 + 현장 GPS 선택
-- ============================================================

ALTER TABLE public.store_applications
  ADD COLUMN IF NOT EXISTS business_license_path TEXT,
  ADD COLUMN IF NOT EXISTS business_license_file_name TEXT,
  ADD COLUMN IF NOT EXISTS business_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS has_agency BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS agency_name TEXT,
  ADD COLUMN IF NOT EXISTS gps_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gps_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS gps_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS gps_accuracy_m NUMERIC,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'auto_checked', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS store_applications_verification_status_idx
  ON public.store_applications (verification_status);

CREATE INDEX IF NOT EXISTS store_applications_gps_verified_at_idx
  ON public.store_applications (gps_verified_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'owner-verifications',
  'owner-verifications',
  false,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'service owner verifications all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service owner verifications all"
      ON storage.objects FOR ALL
      TO service_role
      USING (bucket_id = 'owner-verifications')
      WITH CHECK (bucket_id = 'owner-verifications')
    $policy$;
  END IF;
END $$;
