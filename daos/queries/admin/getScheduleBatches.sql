/* 운영 일정 — 배치별 마지막 실행 (성공/실패 각각) · 크론 체인이 살아 있는지 (관리자, 2026-08-16) */
SELECT batch_name,
       TO_CHAR(MAX(finished_at) FILTER (WHERE status = 'success'), 'YYYY-MM-DD HH24:MI') AS last_success,
       TO_CHAR(MAX(finished_at) FILTER (WHERE status = 'failed'),  'YYYY-MM-DD HH24:MI') AS last_failed,
       (SELECT status FROM batch_runs b2 WHERE b2.batch_name = b.batch_name ORDER BY started_at DESC LIMIT 1) AS latest_status,
       (SELECT LEFT(error, 200) FROM batch_runs b2 WHERE b2.batch_name = b.batch_name AND status = 'failed' ORDER BY started_at DESC LIMIT 1) AS last_error,
       COUNT(*) FILTER (WHERE status = 'running' AND started_at < NOW() - INTERVAL '2 hours')::int AS stuck
  FROM batch_runs b
 GROUP BY batch_name
 ORDER BY MAX(started_at) DESC
