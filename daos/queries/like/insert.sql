INSERT INTO likes (type, target_id, user_id)
VALUES ($1, $2, $3)
ON CONFLICT (type, target_id, user_id) DO NOTHING
RETURNING id
