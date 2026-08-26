/* 신고 요약 — 탭 카운트 + nav 배지용. 대상 단위로 센다 */
WITH g AS (
    SELECT type, target_id, COUNT(*) FILTER (WHERE status = 'open') AS open_n
      FROM reports GROUP BY type, target_id
)
SELECT COUNT(*) FILTER (WHERE open_n > 0)::int  AS open_targets
     , COUNT(*) FILTER (WHERE open_n = 0)::int  AS handled_targets
     , COUNT(*)::int                            AS all_targets
  FROM g
