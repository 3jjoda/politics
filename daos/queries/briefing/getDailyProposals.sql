/* 브리핑 — 일별 발의 추이 (막대)
   $1: window_days (int)

   발의가 0인 날(주말·휴회)도 자리를 잡아야 리듬이 보인다.
   generate_series 로 빈 날을 채운다 — 안 채우면 주말이 사라져 매일 발의되는 것처럼 보인다. */
WITH days AS (
    SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day')::date AS day
)
SELECT TO_CHAR(d.day, 'YYYY-MM-DD')          AS day
     , TO_CHAR(d.day, 'MM.DD')               AS day_label
     , EXTRACT(ISODOW FROM d.day)::int       AS dow          -- 6,7 = 토·일
     , COALESCE(c.cnt, 0)::int               AS cnt
  FROM days d
  LEFT JOIN (
      SELECT propose_dt, COUNT(*)::int AS cnt
        FROM bills
       WHERE propose_dt > CURRENT_DATE - $1::int
       GROUP BY propose_dt
  ) c ON c.propose_dt = d.day
 ORDER BY d.day
