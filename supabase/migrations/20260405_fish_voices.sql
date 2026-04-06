-- Fish Audio 성우 모델 테이블
-- 시샵(superadmin)만 수정/삭제 가능, 모든 어드민은 조회 가능

CREATE TABLE IF NOT EXISTS fish_voices (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT NOT NULL,
  ref_id     TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '🎙️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 성우 데이터 삽입
INSERT INTO fish_voices (label, ref_id, emoji)
VALUES ('한국어 남성', '18e99f7be5374fa9b5ae52ed2f51e80d', '🐟')
ON CONFLICT DO NOTHING;
