-- 기존에 등록된 가게 중 image_url이 비어있고 restaurants에 사진이 있는 경우 동기화
UPDATE stores s
SET image_url = r.image_url
FROM restaurants r
WHERE s.naver_place_id = r.naver_place_id
  AND (s.image_url IS NULL OR s.image_url = '')
  AND r.image_url IS NOT NULL
  AND r.image_url != '';
