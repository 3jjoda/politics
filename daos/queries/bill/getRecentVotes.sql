/* 홈 - 최근 표결 결과 (본회의 표결 법안) */
SELECT b.bill_id
     , b.bill_name
     , b.proc_result_name
     , v.for_cnt     AS vote_for
     , v.against_cnt AS vote_against
     , v.abstain_cnt AS vote_abstain
     , v.absent_cnt  AS vote_absent
     , TO_CHAR(v.max_vote_date, 'YYYY-MM-DD') AS vote_date
  FROM bills b
  JOIN (
      SELECT bill_id
           , COUNT(*) FILTER (WHERE vote_result = '찬성') AS for_cnt
           , COUNT(*) FILTER (WHERE vote_result = '반대') AS against_cnt
           , COUNT(*) FILTER (WHERE vote_result = '기권') AS abstain_cnt
           , COUNT(*) FILTER (WHERE vote_result = '불참') AS absent_cnt
           , MAX(vote_date) AS max_vote_date
        FROM bill_votes
       GROUP BY bill_id
  ) v ON v.bill_id = b.bill_id
 WHERE b.proc_result_name IS NOT NULL
   AND b.proc_result_name != ''
 ORDER BY v.max_vote_date DESC NULLS LAST
 LIMIT 5
