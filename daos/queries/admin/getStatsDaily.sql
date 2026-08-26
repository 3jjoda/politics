/* 관리자 방문 통계 — 최근 N일 일별 사이트 전체 페이지뷰·유니크 + 로그인 사용자 수.
   빈 날도 채운다 (generate_series) — 안 채우면 방문 0인 날이 사라져 그래프가 이어져 보인다.
   $1 = 일수 (int) */
WITH days AS (
    SELECT (CURRENT_DATE - (n || ' days')::interval)::date AS d
      FROM generate_series($1::int - 1, 0, -1) AS n
), pv AS (
    SELECT view_date, views, uniques, member_views, member_uniques, new_visitors, returning_visitors
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
     /* 비회원 = 전체 − 회원. 그래프의 주인공이다 — 운영 초기엔 회원(대부분 본인·테스트)이 전체를 지배한다.
        ⚠️ 2026-08-18 이전 행은 member_* 가 0 이라 그 구간 비회원은 과대계상된다 (화면이 각주로 밝힌다) */
     , COALESCE(pv.views - pv.member_views, 0)     AS guest_views
     , COALESCE(pv.uniques - pv.member_uniques, 0) AS guest_uniques
     , COALESCE(pv.member_views, 0)                AS member_views
     , COALESCE(pv.member_uniques, 0)              AS member_uniques
     /* 신규 / 재방문 — 쿠키의 최초 방문일로 판정. 'site' 행에만 값이 있다.
        🔴 **신규 + 재방문 = 그 행의 uniques** 다 (실측 확인). 둘 다 "그날 사이트를 본 서로 다른 방문자"를
           한 번씩 세므로 정확히 같은 집합을 쪼갠 것이다 — 어긋나면 집계 버그이니 점검 신호로 쓸 것.
           ⚠️ 단 회원/비회원 분해(guest_*·member_*)와는 축이 다르다. 교차해서 더하지 말 것.
        ⚠️ 2026-08-27 이전 행은 둘 다 0 — 그 구간은 측정 자체가 없었다 (화면이 각주로 밝힌다) */
     , COALESCE(pv.new_visitors, 0)       AS new_visitors
     , COALESCE(pv.returning_visitors, 0) AS returning_visitors
     , COALESCE(uv.users, 0)   AS users
  FROM days
  LEFT JOIN pv ON pv.view_date = days.d
  LEFT JOIN uv ON uv.visit_date = days.d
 ORDER BY days.d;
