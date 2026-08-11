/* 브리핑 — 가장 최근 "처리" 가 있었던 날과 그날의 결과 분포

   ⚠️ 여기는 **기간 창(window)을 걸지 않는다.**
      발의는 평일마다 있지만 처리는 드물다 — 최근 7일 발의는 98건인데 처리는 0건이었고
      본회의 최근 처리일이 11일 전(2026-07-31)이었다.
      "지난 7일" 로 자르면 이 블록이 늘 비어서 기능이 죽는다.
      대신 **가장 최근 처리일을 찾아 날짜를 명시**하고, 며칠 전인지(days_ago)를 같이 준다.

   본회의(proc_dt)와 위원회(cmt_proc_dt)를 각각 낸다 — 위원회에서 끝나는 법안이 더 많다. */
WITH latest AS (
    SELECT MAX(proc_dt)     AS floor_day
         , MAX(cmt_proc_dt) AS cmt_day
      FROM bills
)
SELECT 'floor'                              AS stage
     , TO_CHAR(b.proc_dt, 'YYYY-MM-DD')     AS day
     , (CURRENT_DATE - b.proc_dt)::int      AS days_ago
     , b.proc_result_name                   AS result
     , COUNT(*)::int                        AS cnt
  FROM bills b, latest l
 WHERE b.proc_dt = l.floor_day
 GROUP BY b.proc_dt, b.proc_result_name

UNION ALL

SELECT 'committee'
     , TO_CHAR(b.cmt_proc_dt, 'YYYY-MM-DD')
     , (CURRENT_DATE - b.cmt_proc_dt)::int
     , b.cmt_proc_result
     , COUNT(*)::int
  FROM bills b, latest l
 WHERE b.cmt_proc_dt = l.cmt_day
 GROUP BY b.cmt_proc_dt, b.cmt_proc_result

 ORDER BY stage, cnt DESC
