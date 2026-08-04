/* 법안 목록 (검색/필터/정렬/페이징) — committee 기준 카테고리
   $1: search (text, nullable)
   $2: proc_result_name (text, nullable)  -- 상태 탭. 'pending' 이면 NULL/'' 매칭
   $3: committee (text, nullable)          -- 카테고리 (쉼표 분리 복수 지원)
   $4: limit (int)
   $5: offset (int)
   $6: party (text, nullable)              -- 대표발의 정당 (쉼표 분리 복수 지원)
   $7: has_analysis (text, 'Y'|'N'|NULL)   -- 'Y'=분석 있는 것만, 'N'=분석 없는 것만
   $8: ai_category_main (text, nullable)   -- AI 분류 main (쉼표 분리 복수 지원)
   $9: sort (text)                          -- 'recent'(default) | 'ai_priority' | 'requested'
   $10: request_status (text, 'any'|'priority'|NULL)  -- 'any'=요청 1명+, 'priority'=요청 임계값 도달
   $11: priority_threshold (int)            -- request_status='priority' 일 때 임계값
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
     , COALESCE(v.for_cnt, 0)     AS vote_for
     , COALESCE(v.against_cnt, 0) AS vote_against
     , COALESCE(v.abstain_cnt, 0) AS vote_abstain
     , COALESCE(v.total_cnt, 0)   AS vote_total
     , (a.bill_id IS NOT NULL)    AS has_ai_analysis
     , a.summary                  AS ai_summary
     , a.category_main            AS ai_category_main
     , a.category_sub             AS ai_category_sub
     , COALESCE(rc.request_count, 0) AS analysis_request_count
     , COUNT(*) OVER() AS total_count
     , ((NOW() AT TIME ZONE 'Asia/Seoul')::date - b.propose_dt)::int AS days_elapsed
  FROM bills b
  LEFT JOIN (
      SELECT bill_id
           , COUNT(*) FILTER (WHERE vote_result = '찬성') AS for_cnt
           , COUNT(*) FILTER (WHERE vote_result = '반대') AS against_cnt
           , COUNT(*) FILTER (WHERE vote_result IN ('기권','불참')) AS abstain_cnt
           , COUNT(*) AS total_cnt
        FROM bill_votes
       GROUP BY bill_id
  ) v ON v.bill_id = b.bill_id
  LEFT JOIN politicians p                   ON p.mona_cd = b.mona_cd
  LEFT JOIN bill_ai_analysis a              ON a.bill_id = b.bill_id
  LEFT JOIN bill_analysis_request_counts rc ON rc.bill_id = b.bill_id
 WHERE ($1::text IS NULL OR b.bill_name ILIKE '%' || $1 || '%' OR b.proposer_name ILIKE '%' || $1 || '%' OR b.bill_no = $1)
   AND ($2::text IS NULL
        OR ($2 = 'pending' AND (b.proc_result_name IS NULL OR b.proc_result_name = ''))
        OR b.proc_result_name = $2)
   AND ($3::text IS NULL OR b.committee = ANY(string_to_array($3, ',')))
   AND ($6::text IS NULL OR COALESCE(p.party_name, '기타/무소속') = ANY(string_to_array($6, ',')))
   AND ($7::text IS NULL
        OR ($7 = 'Y' AND a.bill_id IS NOT NULL)
        OR ($7 = 'N' AND a.bill_id IS NULL))
   AND ($8::text IS NULL OR a.category_main = ANY(string_to_array($8, ',')))
   AND ($10::text IS NULL
        OR ($10 = 'any'      AND COALESCE(rc.request_count, 0) >= 1)
        OR ($10 = 'priority' AND COALESCE(rc.request_count, 0) >= $11))
 ORDER BY
   CASE WHEN $9 = 'ai_priority' THEN (a.bill_id IS NOT NULL)::int END DESC NULLS LAST,
   CASE WHEN $9 = 'requested'   THEN (a.bill_id IS NOT NULL)::int END DESC NULLS LAST,
   CASE WHEN $9 = 'requested'   THEN COALESCE(rc.request_count, 0) END DESC NULLS LAST,
   b.propose_dt DESC NULLS LAST,
   b.bill_id DESC
 LIMIT $4 OFFSET $5
