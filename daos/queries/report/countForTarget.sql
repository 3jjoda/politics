/* 이 대상의 신고 건수 + 내가 신고했는지 — 신고 버튼 상태용
   $1 type, $2 target_id, $3 user_id (NULL 가능) */
SELECT COUNT(*)::int AS total
     , COUNT(*) FILTER (WHERE $3::int IS NOT NULL AND user_id = $3)::int AS mine
  FROM reports
 WHERE type = $1 AND target_id = $2
