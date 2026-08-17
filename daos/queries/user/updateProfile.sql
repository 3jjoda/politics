/* 성별·연령대 변경 (마이페이지, 2026-08-16) — 통계용 값이라 본인이 고칠 수 있어야 한다.
   $1 user_id, $2 gender ('male'|'female'|'other'), $3 age_group ('10s'~'60s')
   값 검증은 AuthService.validateGender / validateAgeGroup 이 한다 (여기선 안 거른다) */
UPDATE users
   SET gender = $2, age_group = $3
 WHERE user_id = $1
RETURNING user_id, gender, age_group
