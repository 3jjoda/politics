/* 내 활동 — 종류 하나의 한 페이지 (마이페이지, 2026-08-16)
   $1 user_id · $2 kind ('comment'|'vote'|'rating'|'post') · $3 limit · $4 offset
   total 은 윈도 카운트로 같이 낸다. ⚠️ 본인 전용 화면 — 다른 사람의 활동 기록 표시에 재사용하지 말 것 */
WITH x AS (
  SELECT 'comment' AS kind, c.id::text AS id, c.type AS sub, c.target_id,
         CASE c.type
           WHEN 'politician' THEN (SELECT p.name FROM politicians p WHERE p.mona_cd = c.target_id)
           WHEN 'bill'       THEN (SELECT b.bill_name FROM bills b WHERE b.bill_id = c.target_id)
           WHEN 'post'       THEN (SELECT po.title FROM posts po WHERE po.id::text = c.target_id)
           WHEN 'briefing'   THEN (SELECT bp.headline FROM briefing_posts bp WHERE bp.id::text = c.target_id)
         END AS title,
         LEFT(c.content, 120) AS detail, c.created_at AS ts
    FROM comments c
   WHERE $2 = 'comment' AND c.user_id = $1 AND c.is_deleted = FALSE
  UNION ALL
  SELECT 'vote', v.bill_id, v.vote, v.bill_id, b.bill_name, NULL, v.updated_at
    FROM bill_citizen_votes v JOIN bills b ON b.bill_id = v.bill_id
   WHERE $2 = 'vote' AND v.user_id = $1
  UNION ALL
  SELECT 'rating', r.politician_id, r.score::text, r.politician_id, COALESCE(p.name, '(퇴임)'), p.party_name, r.updated_at
    FROM politician_ratings r LEFT JOIN politicians p ON p.mona_cd = r.politician_id
   WHERE $2 = 'rating' AND r.user_id = $1
  UNION ALL
  SELECT 'post', po.id::text, NULL, po.id::text, po.title, LEFT(po.content, 120), po.created_at
    FROM posts po
   WHERE $2 = 'post' AND po.user_id = $1 AND po.is_deleted = FALSE
)
SELECT kind, id, sub, target_id, title, detail,
       TO_CHAR(ts, 'YYYY-MM-DD HH24:MI') AS created_at,
       COUNT(*) OVER()::int AS total
  FROM x
 ORDER BY ts DESC
 LIMIT $3 OFFSET $4
