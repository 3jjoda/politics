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
     , b.committee AS bill_topic_nm
  FROM bills b
 WHERE b.bill_id = $1
