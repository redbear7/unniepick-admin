-- 가게 삭제 시 연관 데이터 cascade 처리
-- coupons, store_contexts, music_references, store_music_profiles, propagation_history

-- 1. coupons: store_id FK에 ON DELETE CASCADE 추가
ALTER TABLE coupons
  DROP CONSTRAINT IF EXISTS coupons_store_id_fkey;

ALTER TABLE coupons
  ADD CONSTRAINT coupons_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 2. store_contexts: store_id FK에 ON DELETE CASCADE 추가
ALTER TABLE store_contexts
  DROP CONSTRAINT IF EXISTS store_contexts_store_id_fkey;

ALTER TABLE store_contexts
  ADD CONSTRAINT store_contexts_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 3. music_references: store_id FK에 ON DELETE CASCADE 추가
ALTER TABLE music_references
  DROP CONSTRAINT IF EXISTS music_references_store_id_fkey;

ALTER TABLE music_references
  ADD CONSTRAINT music_references_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 4. store_music_profiles: store_id FK에 ON DELETE CASCADE 추가
ALTER TABLE store_music_profiles
  DROP CONSTRAINT IF EXISTS store_music_profiles_store_id_fkey;

ALTER TABLE store_music_profiles
  ADD CONSTRAINT store_music_profiles_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 5. propagation_history: from_store_id, to_store_id FK에 ON DELETE CASCADE 추가
ALTER TABLE propagation_history
  DROP CONSTRAINT IF EXISTS propagation_history_from_store_id_fkey;
ALTER TABLE propagation_history
  DROP CONSTRAINT IF EXISTS propagation_history_to_store_id_fkey;

ALTER TABLE propagation_history
  ADD CONSTRAINT propagation_history_from_store_id_fkey
  FOREIGN KEY (from_store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE propagation_history
  ADD CONSTRAINT propagation_history_to_store_id_fkey
  FOREIGN KEY (to_store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- 6. tts_daily_usage: store_id는 text 타입이므로 FK 없음 → 삭제 로직은 앱에서 처리
-- (migration으로 처리 불가, deleteStore 함수에서 명시적으로 삭제)
