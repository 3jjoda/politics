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
       -- 국회 공식 "제안이유 및 주요내용" 원문. AI 분석이 없는 법안의 본문 섹션 소스.
       -- 목록(getList)과 달리 절단하지 않는다 — 상세는 전문을 보여주는 자리다.
     , b.summary
  FROM bills b
 WHERE b.bill_id = $1
