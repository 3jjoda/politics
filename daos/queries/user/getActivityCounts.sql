/* 내 활동 총계 (마이페이지, 2026-08-16) — $1 user_id
   ⚠️ 본인 전용. 다른 사람의 활동 기록 표시에 재사용하지 말 것 */
SELECT (SELECT COUNT(*) FROM comments           WHERE user_id = $1 AND is_deleted = FALSE)::int AS comments,
       (SELECT COUNT(*) FROM bill_citizen_votes WHERE user_id = $1)::int AS votes,
       (SELECT COUNT(*) FROM politician_ratings WHERE user_id = $1)::int AS ratings,
       (SELECT COUNT(*) FROM posts              WHERE user_id = $1 AND is_deleted = FALSE)::int AS posts
