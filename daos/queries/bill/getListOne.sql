/* 법안 목록 */
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
     , b.propose_dt
     , b.committee
     , b.committee_id
     , b.proc_result_cd
     , b.proc_result_name
     , b.link_url
     , b.bill_topic_cd
     , c.code_name  AS bill_topic_nm
     , b.created_at
     , b.updated_at
  FROM bills b
  JOIN codes c
    ON c.group_code = 'BILL_TOPIC'
   AND c.code_id = b.bill_topic_cd
 WHERE mona_cd = ?