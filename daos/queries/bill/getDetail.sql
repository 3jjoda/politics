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
       -- 처리 단계 날짜 — 상세의 "처리 경과" 타임라인 소스.
       -- TO_CHAR 로 문자열화해서 넘긴다: DATE 를 JS Date 로 받으면 타임존 해석이 끼어 하루 밀린다.
     , TO_CHAR(b.committee_dt,   'YYYY-MM-DD') AS committee_dt
     , TO_CHAR(b.cmt_present_dt, 'YYYY-MM-DD') AS cmt_present_dt
     , TO_CHAR(b.cmt_proc_dt,    'YYYY-MM-DD') AS cmt_proc_dt
     , b.cmt_proc_result
     , TO_CHAR(b.law_submit_dt,  'YYYY-MM-DD') AS law_submit_dt
     , TO_CHAR(b.law_present_dt, 'YYYY-MM-DD') AS law_present_dt
     , TO_CHAR(b.law_proc_dt,    'YYYY-MM-DD') AS law_proc_dt
     , b.law_proc_result
     , TO_CHAR(b.proc_dt,        'YYYY-MM-DD') AS proc_dt
       -- 국회 공식 "제안이유 및 주요내용" 원문. AI 분석이 없는 법안의 본문 섹션 소스.
       -- 목록(getList)과 달리 절단하지 않는다 — 상세는 전문을 보여주는 자리다.
     , b.summary
  FROM bills b
 WHERE b.bill_id = $1
