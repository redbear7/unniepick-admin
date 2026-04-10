-- aircon_requests: 설치 장소, 주소, 메모 컬럼 추가
alter table aircon_requests
  add column if not exists location  text,   -- 설치 장소 (거실, 안방 등)
  add column if not exists address   text,   -- 주소
  add column if not exists memo      text;   -- 추가 요청 사항
