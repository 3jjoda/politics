/* 정치인 상세 - 최근 12개월 월별 발의 건수 */
WITH months AS (
  SELECT DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Seoul')::date) - (n || ' month')::INTERVAL AS ym
    FROM generate_series(11, 0, -1) n
)
SELECT TO_CHAR(m.ym, 'YYYY-MM') AS ym
     , TO_CHAR(m.ym, 'MM')       AS mm
     , COALESCE(x.cnt, 0)        AS cnt
  FROM months m
  LEFT JOIN (
      SELECT DATE_TRUNC('month', propose_dt) AS ym
           , COUNT(*) AS cnt
        FROM bills
       WHERE mona_cd = $1
         AND propose_dt >= DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Seoul')::date) - INTERVAL '11 month'
       GROUP BY DATE_TRUNC('month', propose_dt)
  ) x ON x.ym = m.ym
 ORDER BY m.ym
