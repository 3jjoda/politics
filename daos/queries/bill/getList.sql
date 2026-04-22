/* 법안 목록 (검색/필터/페이징)
   $1: search (text, nullable)
   $2: proc_result_name (text, nullable)  -- 상태 탭
   $3: bill_topic_cd (int, nullable)       -- 카테고리
   $4: limit (int)
   $5: offset (int)
*/
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
     , c1.code_name  AS bill_topic_nm
     , COALESCE(v.for_cnt, 0)     AS vote_for
     , COALESCE(v.against_cnt, 0) AS vote_against
     , COALESCE(v.abstain_cnt, 0) AS vote_abstain
     , COALESCE(v.total_cnt, 0)   AS vote_total
     , COUNT(*) OVER() AS total_count
     , (CURRENT_DATE - b.propose_dt)::int AS days_elapsed
  FROM bills b
  LEFT JOIN codes c1
    ON c1.group_code = 'BILL_TOPIC'
   AND c1.code_id = b.bill_topic_cd
  LEFT JOIN (
      SELECT bill_id
           , COUNT(*) FILTER (WHERE vote_result = '찬성') AS for_cnt
           , COUNT(*) FILTER (WHERE vote_result = '반대') AS against_cnt
           , COUNT(*) FILTER (WHERE vote_result IN ('기권','불참')) AS abstain_cnt
           , COUNT(*) AS total_cnt
        FROM bill_votes
       GROUP BY bill_id
  ) v ON v.bill_id = b.bill_id
 WHERE ($1::text IS NULL OR b.bill_name ILIKE '%' || $1 || '%' OR b.proposer_name ILIKE '%' || $1 || '%' OR b.bill_no = $1)
   AND ($2::text IS NULL
        OR ($2 = 'pending' AND (b.proc_result_name IS NULL OR b.proc_result_name = ''))
        OR b.proc_result_name = $2)
   AND ($3::int  IS NULL OR b.bill_topic_cd = $3)
 ORDER BY b.propose_dt DESC NULLS LAST, b.bill_id DESC
 LIMIT $4 OFFSET $5
