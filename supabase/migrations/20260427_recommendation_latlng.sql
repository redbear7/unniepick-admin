-- 추천맛집에 위도/경도 추가 (거리순 정렬용)
alter table public.user_recommendations
  add column if not exists place_lat double precision,
  add column if not exists place_lng double precision;
