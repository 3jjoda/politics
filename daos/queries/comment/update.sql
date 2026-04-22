/* 댓글 수정 (본인만 — user_id 일치 조건)
   $1 content, $2 id, $3 user_id
*/
UPDATE comments
   SET content = $1
 WHERE id = $2 AND user_id = $3 AND is_deleted = FALSE
 RETURNING id, type, target_id, parent_id, user_id, content, is_deleted, created_at, updated_at
