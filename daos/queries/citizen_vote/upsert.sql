/* 찬반 UPSERT */
INSERT INTO bill_citizen_votes (bill_id, user_id, vote)
VALUES ($1, $2, $3)
ON CONFLICT (bill_id, user_id)
DO UPDATE SET vote = EXCLUDED.vote, updated_at = NOW()
RETURNING bill_id, user_id, vote, created_at, updated_at
