/* 관리자 삭제·복구 — $1 id, $2 is_deleted (위 setCommentDeleted.sql 주의 참조) */
UPDATE posts SET is_deleted = $2 WHERE id = $1 RETURNING id
