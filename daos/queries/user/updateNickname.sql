/* 닉네임 변경 — 자기 자신의 행만, 새 닉네임이 다른 사용자에게 점유되지 않은 경우에만
   $1 user_id, $2 new_nickname
   RETURNING 행이 0이면 (1) user_id 미존재 또는 (2) 닉네임 충돌
*/
UPDATE users
   SET nickname = $2
 WHERE user_id  = $1
   AND NOT EXISTS (
        SELECT 1 FROM users u2
         WHERE u2.nickname = $2 AND u2.user_id <> $1
   )
RETURNING user_id, nickname
