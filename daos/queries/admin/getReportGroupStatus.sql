/* 한 대상의 현재 상태 — 처리 전에 읽는다.
   🔴 `살려둠` 이 대상을 되살려도 되는지 판정하는 데 쓴다. 아래 AdminController 참조 */
SELECT COUNT(*)::int AS n
     , CASE WHEN COUNT(*) FILTER (WHERE status = 'open') > 0 THEN 'open'
            ELSE (array_agg(status ORDER BY handled_at DESC NULLS LAST))[1] END AS status
  FROM reports
 WHERE type = $1 AND target_id = $2
