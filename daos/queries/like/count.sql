SELECT COUNT(*)::int AS cnt
  FROM likes
 WHERE type = $1 AND target_id = $2
