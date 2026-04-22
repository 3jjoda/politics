/* 법안 상세정보 */
SELECT b.bill_id
     , b.bill_no
     , b.bill_name
     , b.bill_kind_cd
     , b.age_cd
     , b.age_name
     , b.proposer_kind_cd
     , b.proposer_name
     , b.mona_cd
     , b.co_proposer_count
     , TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS propose_dt
     , b.committee
     , b.committee_id
     , b.proc_result_cd
     , b.proc_result_name
     , b.link_url
     , b.bill_topic_cd
     , c1.code_name AS bill_topic_nm
  FROM bills b
  LEFT JOIN codes c1
    ON c1.group_code = 'BILL_TOPIC'
   AND c1.code_id = b.bill_topic_cd
 WHERE b.bill_id = $1
