/* 관리자 방문 통계 — 최근 N일 페이지 종류별 합계 ('site' 는 총계라 제외)
   비회원 = views - member_views (2026-08-18 분리. 그 이전 행은 member_* 가 0 이라 전부 비회원으로 잡힌다)
   $1 = 일수 */
SELECT page_kind
     , SUM(views)::int                          AS views
     , SUM(uniques)::int                        AS uniques
     , SUM(views - member_views)::int           AS guest_views
     , SUM(uniques - member_uniques)::int       AS guest_uniques
     , SUM(member_views)::int                   AS member_views
     , SUM(member_uniques)::int                 AS member_uniques
  FROM page_views_daily
 WHERE page_kind <> 'site' AND view_date >= CURRENT_DATE - ($1::int - 1)
 GROUP BY page_kind
 ORDER BY guest_views DESC, views DESC;
