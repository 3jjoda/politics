/* 회원 탈퇴 (소프트) — 실제 행은 유지하고 개인 식별 정보만 익명화
   $1 user_id
   → email, nickname, provider_id 등 식별 정보는 지움
   → gender, age_group 은 보존 (통계 집계 목적)
   → 같은 소셜 계정으로 재가입 가능 (provider_id NULL 로 복합 UNIQUE 충돌 없음)
*/
UPDATE users
   SET email       = NULL,
       nickname    = NULL,
       provider    = 'deleted',
       provider_id = NULL,
       password    = NULL
 WHERE user_id = $1
RETURNING user_id
