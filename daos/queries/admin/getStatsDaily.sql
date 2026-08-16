/* 관리자 방문 통계 — 최근 N일 일별 사이트 전체 페이지뷰·유니크 + 로그인 사용자 수.
   빈 날도 채운다 (generate_series) — 안 채우면 방문 0인 날이 사라져 그래프가 이어져 보인다.
   $1 = 일수 (int) */
WITH days AS (
    SELECT (CURRENT_DATE - (n || ' days')::interval)::date AS d
      FROM generate_series($1::int - 1, 0, -1) AS n
), pv AS (
    SELECT view_date, views, uniques
      FROM page_views_daily
     WHERE page_kind = 'site' AND view_date >= CURRENT_DATE - ($1::int - 1)
), uv AS (
    SELECT visit_date, COUNT(*)::int AS users
      FROM user_visit_days
     WHERE visit_date >= CURRENT_DATE - ($1::int - 1)
     GROUP BY visit_date
)
SELECT TO_CHAR(days.d, 'YYYY-MM-DD') AS d
     , TO_CHAR(days.d, 'MM.DD')      AS label
     , EXTRACT(ISODOW FROM days.d)::int >= 6 AS is_weekend
     , COALESCE(pv.views, 0)   AS views
     , COALESCE(pv.uniques, 0) AS uniques
     , COALESCE(uv.users, 0)   AS users
  FROM days
  LEFT JOIN pv ON pv.view_date = days.d
  LEFT JOIN uv ON uv.visit_date = days.d
 ORDER BY days.d;
