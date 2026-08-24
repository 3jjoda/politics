-- 내 지역구 등록·변경 (2026-08-23)
-- ⚠️ 값 검증(실제 지역구인가)은 서비스가 화이트리스트로 한다. 여기선 저장만.
-- ⚠️ NULL 을 넣으면 등록 해제다 — 지우는 길이 없으면 한 번 고르면 못 무른다.
UPDATE users
   SET district = $2
 WHERE user_id = $1
RETURNING user_id, district
