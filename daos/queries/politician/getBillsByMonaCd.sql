/* 정치인 상세 - 발의/공동발의 법안 목록
   bills.mona_cd 대표발의 + bill_co_proposers 공동발의 합산
*/
SELECT b.bill_id
     , b.bill_no
     , b.bill_name
     , b.committee
     , b.proposer_kind_cd
     , TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS propose_dt
     , b.proc_result_name
     , b.link_url
     , b.committee AS bill_topic_nm
     , (b.mona_cd = $1) AS proposer_yn
     , ((NOW() AT TIME ZONE 'Asia/Seoul')::date - b.propose_dt)::int AS days_elapsed
     , (SELECT vote_result FROM bill_votes
         WHERE bill_id = b.bill_id AND mona_cd = $1 LIMIT 1) AS my_vote_result
  FROM bills b
 WHERE b.mona_cd = $1
    OR b.bill_id IN (SELECT bill_id FROM bill_co_proposers WHERE mona_cd = $1)
 ORDER BY b.propose_dt DESC NULLS LAST, b.bill_id DESC
