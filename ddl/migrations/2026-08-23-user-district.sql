-- 2026-08-23 · 내 지역구 등록 (users.district)
--
-- 왜: 이 사이트의 개인화 진입점이 **성향 진단(20문항)뿐**이었는데 실측 완료자가 3명이다.
--     지역구는 로그인 후 클릭 두 번이라 장벽이 압도적으로 낮고, "당 말고 사람" 축에 정확히 맞는다
--     (내가 뽑은 사람이 지금 뭐 하고 있나).
--
-- 🔴 **mona_cd 가 아니라 지역구 문자열을 저장한다.** 선거·보선으로 사람이 바뀌어도
--    "내 지역구" 는 유지돼야 한다. 의원은 조회 시점에 찾는다 (현직 우선).
--    실측: 한 지역구에 현직 1 + 퇴임 1 인 곳이 8군데 (울산 남구갑 = 김태규 / 김상욱(퇴임) 등).
-- ⚠️ **사용자가 스스로 고른 값이다.** 우리가 관찰해 추론한 게 아니라 성별·연령대와 같은 성격이라
--    개인정보처리방침의 회원 정보 항목에 포함된다. 열람 기록(어느 의원 페이지를 봤나)과는 성격이 다르다 —
--    그건 여전히 만들지 않는다.
-- ⚠️ 값 검증은 **DB 의 electoral_district 화이트리스트**로 한다 (임의 문자열 저장 금지).
-- ⚠️ 인덱스를 두지 않는다 — 조회가 항상 user_id 로 시작한다 (PK).

ALTER TABLE users ADD COLUMN IF NOT EXISTS district VARCHAR(60);

COMMENT ON COLUMN users.district IS
  '사용자가 고른 지역구명 (politicians.electoral_district 값 중 하나). '
  '의원 mona_cd 가 아니라 지역구를 저장한다 — 선거로 사람이 바뀌어도 유지되어야 하므로.';

-- 검증
--   SELECT COUNT(*) FROM users WHERE district IS NOT NULL;
--   SELECT u.district, COUNT(*) FROM users u WHERE u.district IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
