/* 회원 탈퇴 (소프트) — 실제 행은 유지하고 개인정보만 익명화
   $1 user_id
   → 댓글·평점·찬반 등 외래 참조는 그대로 유지되나 작성자 이름이 NULL 로 바뀜
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
