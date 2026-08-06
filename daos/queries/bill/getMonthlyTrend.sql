/* 홈 - 월별 법안 처리 추이 (최근 12개월)
   월별 발의수 / 처리수(가결+부결+대안반영폐기 등 처리완료된 것) 집계
*/
WITH months AS (
  SELECT DATE_TRUNC('month', CURRENT_DATE) - (n || ' month')::INTERVAL AS ym
    FROM generate_series(11, 0, -1) n
)
SELECT TO_CHAR(m.ym, 'YYYY-MM')                AS ym
     , TO_CHAR(m.ym, 'MM')                     AS mm
     , COALESCE(p.propose_cnt, 0)              AS propose_cnt
     , COALESCE(p.processed_cnt, 0)            AS processed_cnt
  FROM months m
  LEFT JOIN (
      SELECT DATE_TRUNC('month', propose_dt) AS ym
           , COUNT(*)                                                   AS propose_cnt
           , COUNT(*) FILTER (WHERE proc_result_name IS NOT NULL
                              AND proc_result_name != '')               AS processed_cnt
        FROM bills
       WHERE propose_dt >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 month'
       GROUP BY DATE_TRUNC('month', propose_dt)
  ) p ON p.ym = m.ym
 ORDER BY m.ym
