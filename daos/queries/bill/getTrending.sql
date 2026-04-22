/* 홈 - 주목할 법안 (최근 처리된 법안 상위 6건) */
SELECT b.bill_id
     , b.bill_no
     , b.bill_name
     , b.proposer_name
     , b.co_proposer_count
     , TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS propose_dt
     , b.proc_result_name
     , c1.code_name AS bill_topic_nm
     , COALESCE(v.for_cnt, 0)     AS vote_for
     , COALESCE(v.against_cnt, 0) AS vote_against
     , COALESCE(v.abstain_cnt, 0) AS vote_abstain
  FROM bills b
  LEFT JOIN codes c1
    ON c1.group_code = 'BILL_TOPIC'
   AND c1.code_id = b.bill_topic_cd
  LEFT JOIN (
      SELECT bill_id
           , COUNT(*) FILTER (WHERE vote_result = '찬성') AS for_cnt
           , COUNT(*) FILTER (WHERE vote_result = '반대') AS against_cnt
           , COUNT(*) FILTER (WHERE vote_result IN ('기권','불참')) AS abstain_cnt
        FROM bill_votes
       GROUP BY bill_id
  ) v ON v.bill_id = b.bill_id
 WHERE b.proc_result_name IS NOT NULL
   AND b.proc_result_name != ''
 ORDER BY b.propose_dt DESC NULLS LAST, b.bill_id DESC
 LIMIT 6
