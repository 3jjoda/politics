/* 정치인 상세 - 표결 내역 */
SELECT bv.bill_id
     , bv.bill_no
     , bv.vote_result
     , TO_CHAR(bv.vote_date, 'YYYY-MM-DD') AS vote_date
     , b.bill_name
     , b.proc_result_name
     , b.bill_topic_cd
     , c1.code_name AS bill_topic_nm
  FROM bill_votes bv
  LEFT JOIN bills b ON b.bill_id = bv.bill_id
  LEFT JOIN codes c1
    ON c1.group_code = 'BILL_TOPIC'
   AND c1.code_id = b.bill_topic_cd
 WHERE bv.mona_cd = $1
 ORDER BY bv.vote_date DESC
