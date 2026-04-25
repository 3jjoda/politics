/* 내가 요청한 법안 (마이페이지) */
SELECT b.bill_id
     , b.bill_no
     , b.bill_name
     , b.proposer_name
     , b.committee
     , b.proc_result_name
     , TO_CHAR(b.propose_dt, 'YYYY.MM.DD')           AS propose_dt
     , TO_CHAR(r.requested_at, 'YYYY.MM.DD HH24:MI') AS requested_at
     , (a.bill_id IS NOT NULL)                       AS has_ai_analysis
     , a.summary                                     AS ai_summary
     , a.category_main                               AS ai_category_main
     , a.category_sub                                AS ai_category_sub
     , COALESCE(rc.request_count, 0)                 AS request_count
  FROM bill_analysis_requests r
  JOIN bills b                              ON b.bill_id = r.bill_id
  LEFT JOIN bill_ai_analysis a              ON a.bill_id = b.bill_id
  LEFT JOIN bill_analysis_request_counts rc ON rc.bill_id = b.bill_id
 WHERE r.user_id = $1
 ORDER BY r.requested_at DESC
