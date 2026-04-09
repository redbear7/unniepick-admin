-- 기존 정책 이름을 회원 등급제(스타터/프로/프리미엄)에 맞게 정리
-- tts_policies 테이블이 이미 존재하는 경우 적용

-- 기존 구 이름 삭제 후 재삽입 (on conflict update)
insert into tts_policies (name, daily_char_limit, description, sort_order) values
  ('스타터',   500,  '하루 500자 (기본 템플릿)',    0),
  ('프로',    3000,  '하루 3,000자 (커스텀 TTS)',   1),
  ('프리미엄',   -1,  '무제한 (다국어 AI 음성안내)', 2)
on conflict (name) do update
  set daily_char_limit = excluded.daily_char_limit,
      description      = excluded.description,
      sort_order       = excluded.sort_order;

-- 구 이름(무료/베이직/무제한) 삭제 (연결된 stores 없는 경우)
delete from tts_policies
where name in ('무료', '베이직', '무제한')
  and id not in (select tts_policy_id from stores where tts_policy_id is not null);
