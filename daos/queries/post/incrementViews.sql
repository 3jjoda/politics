UPDATE posts
   SET view_count = view_count + 1
 WHERE id = $1 AND is_deleted = FALSE
RETURNING view_count
