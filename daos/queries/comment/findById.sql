SELECT id, type, target_id, parent_id, user_id, content, is_deleted, created_at, updated_at
  FROM comments
 WHERE id = $1
