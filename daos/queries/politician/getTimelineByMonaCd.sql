/* 정치인 상세 - 대표발의 법안 타임라인 (최근 5건) */
SELECT b.bill_id
     , b.bill_name
     , TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS propose_dt
     , b.proc_result_name
  FROM bills b
 WHERE b.mona_cd = $1
 ORDER BY b.propose_dt DESC NULLS LAST, b.bill_id DESC
 LIMIT 5
