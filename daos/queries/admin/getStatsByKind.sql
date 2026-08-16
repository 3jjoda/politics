/* 관리자 방문 통계 — 최근 N일 페이지 종류별 합계 ('site' 는 총계라 제외)
   $1 = 일수 */
SELECT page_kind
     , SUM(views)::int   AS views
     , SUM(uniques)::int AS uniques
  FROM page_views_daily
 WHERE page_kind <> 'site' AND view_date >= CURRENT_DATE - ($1::int - 1)
 GROUP BY page_kind
 ORDER BY views DESC;
