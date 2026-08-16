/* 관리자 방문 통계 — 사용자별 접속 (최근 N일, 접속일 많은 순). 탈퇴자는 닉네임이 NULL 이라 '(탈퇴)'.
   $1 = 일수, $2 = 상한 */
SELECT u.user_id
     , COALESCE(u.nickname, '(탈퇴)') AS nickname
     , u.provider
     , TO_CHAR(u.created_at, 'YYYY-MM-DD') AS joined
     , COUNT(v.visit_date)::int AS days
     , COALESCE(SUM(v.views), 0)::int AS views
     , TO_CHAR(MAX(v.visit_date), 'MM.DD') AS last_visit
     , (SELECT COUNT(*)::int FROM user_visit_days a WHERE a.user_id = u.user_id) AS total_days
  FROM user_visit_days v
  JOIN users u ON u.user_id = v.user_id
 WHERE v.visit_date >= CURRENT_DATE - ($1::int - 1)
 GROUP BY u.user_id, u.nickname, u.provider, u.created_at
 ORDER BY days DESC, views DESC
 LIMIT $2::int;
