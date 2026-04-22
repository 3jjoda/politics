/* 댓글 작성
   $1 type, $2 target_id, $3 parent_id, $4 user_id, $5 content
*/
INSERT INTO comments (type, target_id, parent_id, user_id, content)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, type, target_id, parent_id, user_id, content, is_deleted, created_at, updated_at
