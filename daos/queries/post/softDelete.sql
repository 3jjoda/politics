/* 소프트 삭제 (본인만)
   $1 id, $2 user_id
*/
UPDATE posts
   SET is_deleted = TRUE
 WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE
RETURNING id
