-- ============================================================
-- activity_events: 실시간 참여 피드 + 지오펜스 이벤트
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     TEXT NOT NULL CHECK (
                   event_type IN (
                     'coupon_created',
                     'coupon_saved',
                     'coupon_used',
                     'shorts_requested',
                     'shorts_created',
                     'store_joined',
                     'review_claimed',
                     'geofence_entered',
                     'route_clicked',
                     'share_clicked'
                   )
                 ),
  actor_type     TEXT NOT NULL DEFAULT 'system'
                   CHECK (actor_type IN ('user', 'owner', 'admin', 'system')),
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id       UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  coupon_id      UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  source_table   TEXT,
  source_id      UUID,
  area           TEXT NOT NULL DEFAULT '창원 상권',
  title          TEXT NOT NULL,
  detail         TEXT,
  geofence_id    TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  radius_m       INTEGER,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility     TEXT NOT NULL DEFAULT 'public'
                   CHECK (visibility IN ('public', 'admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx ON public.activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_type_idx       ON public.activity_events (event_type);
CREATE INDEX IF NOT EXISTS activity_events_area_idx       ON public.activity_events (area);
CREATE INDEX IF NOT EXISTS activity_events_store_idx      ON public.activity_events (store_id);
CREATE INDEX IF NOT EXISTS activity_events_coupon_idx     ON public.activity_events (coupon_id);
CREATE INDEX IF NOT EXISTS activity_events_geo_idx        ON public.activity_events (geofence_id);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- 공개 피드는 익명화된 public 이벤트만 조회 가능
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_events' AND policyname = 'public activity read'
  ) THEN
    EXECUTE 'CREATE POLICY "public activity read" ON public.activity_events FOR SELECT TO anon, authenticated USING (visibility = ''public'')';
  END IF;
END $$;

-- 로그인 사용자는 본인 user_id로만 이벤트를 기록할 수 있음
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_events' AND policyname = 'user own activity insert'
  ) THEN
    EXECUTE 'CREATE POLICY "user own activity insert" ON public.activity_events FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR auth.uid() = user_id)';
  END IF;
END $$;

-- service_role은 API 서버/관리자용으로 전체 허용
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'activity_events' AND policyname = 'service role full access'
  ) THEN
    EXECUTE 'CREATE POLICY "service role full access" ON public.activity_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 앱 공개 피드에서 사용할 안전한 뷰: 개인 좌표와 user_id를 노출하지 않음
CREATE OR REPLACE VIEW public.activity_feed_public AS
SELECT
  id,
  event_type,
  actor_type,
  store_id,
  coupon_id,
  area,
  title,
  detail,
  geofence_id,
  radius_m,
  metadata,
  created_at
FROM public.activity_events
WHERE visibility = 'public';

GRANT SELECT ON public.activity_feed_public TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
