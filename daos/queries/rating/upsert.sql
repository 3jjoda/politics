/* 별점 UPSERT
   $1 politician_id, $2 user_id, $3 score
*/
INSERT INTO politician_ratings (politician_id, user_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (politician_id, user_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
RETURNING politician_id, user_id, score, created_at, updated_at
