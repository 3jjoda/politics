/* 관리자 방문 통계 — 로그인 사용자 요약 (최근 N일)
   접속일 수 기준. 어느 페이지를 봤는지는 저장하지 않으므로 여기서도 없다.
   $1 = 일수 */
WITH recent AS (
    SELECT user_id, COUNT(*)::int AS days, SUM(views)::int AS views, MAX(visit_date) AS last_visit
      FROM user_visit_days
     WHERE visit_date >= CURRENT_DATE - ($1::int - 1)
     GROUP BY user_id
)
SELECT (SELECT COUNT(*)::int FROM users WHERE provider <> 'deleted')          AS total_users
     , (SELECT COUNT(*)::int FROM recent)                                       AS active_users
     , (SELECT COUNT(*)::int FROM recent WHERE days >= 2)                       AS returning_users
     , (SELECT COUNT(*)::int FROM users WHERE provider <> 'deleted'
                                          AND created_at >= CURRENT_DATE - ($1::int - 1)) AS new_users
     , (SELECT COALESCE(ROUND(AVG(days), 1), 0) FROM recent)                    AS avg_days;
