-- auth.admin.listUsers API 우회용 함수
-- auth.users를 SECURITY DEFINER로 직접 읽음 (service_role 없이도 동작)
CREATE OR REPLACE FUNCTION public.admin_get_user_phones()
RETURNS TABLE (
  id              UUID,
  phone           TEXT,
  email           TEXT,
  created_at      TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE sql
AS $$
  SELECT
    id,
    phone::TEXT,
    email,
    created_at,
    last_sign_in_at
  FROM auth.users;
$$;

-- 어드민(service_role)만 호출 가능하도록 권한 설정
REVOKE ALL ON FUNCTION public.admin_get_user_phones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_phones() TO service_role;
