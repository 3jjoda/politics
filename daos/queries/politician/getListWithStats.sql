/* 정치인 목록 + 발의 건수 집계 */
SELECT p.politician_id
     , p.politician_type
     , p.party_id
     , p.photo_url
     , p.name
     , p.electoral_district
     , p.elect_gbn_nm
     , p.cmit_nm
     , p.reele_gbn_nm
     , p.mona_cd
     , p.party_name
     , p.active_yn
     , COALESCE(b.propose_cnt, 0)     AS propose_cnt
     , COALESCE(cp.co_propose_cnt, 0) AS co_propose_cnt
  FROM politicians p
  LEFT JOIN (
      SELECT mona_cd, COUNT(*) AS propose_cnt
        FROM bills
       WHERE mona_cd IS NOT NULL
       GROUP BY mona_cd
  ) b  ON b.mona_cd = p.mona_cd
  LEFT JOIN (
      SELECT mona_cd, COUNT(*) AS co_propose_cnt
        FROM bill_co_proposers
       WHERE proposer_yn = FALSE
       GROUP BY mona_cd
  ) cp ON cp.mona_cd = p.mona_cd
 WHERE p.active_yn = TRUE
 ORDER BY p.name
