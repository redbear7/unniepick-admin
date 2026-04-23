-- ============================================================
-- users.role 컬럼에 'developer' 값 추가
-- CHECK 제약 조건이 있으면 드롭 후 재생성 (없으면 건너뜀)
-- ============================================================

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- users.role 관련 CHECK 제약 조건 이름 탐색
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    RAISE NOTICE 'Dropping constraint: %', v_constraint;
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_constraint);
  ELSE
    RAISE NOTICE 'No role CHECK constraint found — skipping drop';
  END IF;
END $$;

-- role 컬럼이 ENUM 타입인 경우 처리
DO $$
DECLARE
  v_col_type TEXT;
BEGIN
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'users'
    AND column_name  = 'role';

  RAISE NOTICE 'users.role column type: %', v_col_type;

  -- USER-DEFINED (enum) 인 경우 → enum 에 'developer' 추가
  IF v_col_type = 'USER-DEFINED' THEN
    -- enum 타입 이름 조회
    DECLARE
      v_enum_type TEXT;
    BEGIN
      SELECT udt_name INTO v_enum_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'users'
        AND column_name  = 'role';

      -- 이미 없을 때만 추가
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = v_enum_type
          AND e.enumlabel = 'developer'
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE ''developer''', v_enum_type);
        RAISE NOTICE 'Added developer to enum %', v_enum_type;
      ELSE
        RAISE NOTICE 'developer already in enum %', v_enum_type;
      END IF;
    END;
  END IF;
END $$;

-- TEXT / VARCHAR 컬럼인 경우 → 새 CHECK 제약 조건 추가
DO $$
DECLARE
  v_col_type TEXT;
BEGIN
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'users'
    AND column_name  = 'role';

  IF v_col_type IN ('text', 'character varying') THEN
    -- 기존 제약 중복 방지
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass
        AND contype  = 'c'
        AND conname  = 'users_role_check'
    ) THEN
      ALTER TABLE public.users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('customer', 'owner', 'admin', 'superadmin', 'developer'));
      RAISE NOTICE 'Added users_role_check constraint';
    ELSE
      RAISE NOTICE 'users_role_check already exists';
    END IF;
  END IF;
END $$;
