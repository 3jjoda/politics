/* 정치인 상세 - 표결 내역 */
SELECT bv.bill_id
     , bv.bill_no
     , bv.vote_result
     , TO_CHAR(bv.vote_date, 'YYYY-MM-DD') AS vote_date
     , b.bill_name
     , b.proc_result_name
     , b.committee AS bill_topic_nm
  FROM bill_votes bv
  LEFT JOIN bills b ON b.bill_id = bv.bill_id
 WHERE bv.mona_cd = $1
 ORDER BY bv.vote_date DESC
