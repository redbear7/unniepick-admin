-- business_hours 오염 데이터 정리
-- 원인: 구버전 크롤 스크립트에서 body text fallback이 시간 패턴 필터 없이
--        메뉴명이나 이미지 레이블을 영업시간으로 잘못 저장한 케이스 제거
--
-- 유효한 영업시간 패턴: "11:00~22:00" 또는 "11시~22시" 형태의 ~ 포함 시간
-- → ~ 와 숫자가 함께 없는 경우 무효로 판단

UPDATE restaurants
SET business_hours = NULL
WHERE business_hours IS NOT NULL
  -- 유효한 시간 범위(~)가 없는 경우: HH:MM~HH:MM 또는 HH시~HH시 패턴 확인
  AND NOT (
    business_hours ~ '\d{1,2}[:시]\d{0,2}[분]?\s*~\s*\d{1,2}[:시]\d{0,2}'
  );

-- 정리 결과 확인
SELECT COUNT(*) AS cleaned_count
FROM restaurants
WHERE business_hours IS NULL;
