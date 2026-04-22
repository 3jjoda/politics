DELETE FROM likes
 WHERE type = $1 AND target_id = $2 AND user_id = $3
RETURNING id
