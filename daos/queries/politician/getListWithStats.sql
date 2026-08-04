/* 정치인 목록 + 발의 건수 + 필터용 성별/연령대 버킷 */
WITH pol AS (
  SELECT p.*
       , CASE
           WHEN p.birthday IS NULL THEN NULL
           ELSE (
             EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Asia/Seoul')::date)::int
           - EXTRACT(YEAR FROM p.birthday)::int
           - CASE WHEN TO_CHAR((NOW() AT TIME ZONE 'Asia/Seoul')::date, 'MMDD') < TO_CHAR(p.birthday, 'MMDD') THEN 1 ELSE 0 END
         )
         END AS age
    FROM politicians p
   WHERE p.active_yn = TRUE
)
SELECT pol.politician_id
     , pol.politician_type
     , pol.party_id
     , pol.photo_url
     , pol.name
     , pol.electoral_district
     , pol.elect_gbn_nm
     , pol.cmit_nm
     , pol.reele_gbn_nm
     , pol.mona_cd
     , pol.party_name
     , pol.active_yn
     , pol.sex_gbn_nm
     , CASE
         WHEN pol.age IS NULL            THEN NULL
         WHEN pol.age BETWEEN 20 AND 29  THEN '20s'
         WHEN pol.age BETWEEN 30 AND 39  THEN '30s'
         WHEN pol.age BETWEEN 40 AND 49  THEN '40s'
         WHEN pol.age BETWEEN 50 AND 59  THEN '50s'
         WHEN pol.age BETWEEN 60 AND 69  THEN '60s'
         WHEN pol.age >= 70              THEN '70plus'
         ELSE NULL
       END AS age_bucket
     , COALESCE(b.propose_cnt, 0)     AS propose_cnt
     , COALESCE(cp.co_propose_cnt, 0) AS co_propose_cnt
     , pa.economy::float8     AS axis_economy
     , pa.social::float8      AS axis_social
     , pa.security::float8    AS axis_security
     , pa.institution::float8 AS axis_institution
     , pa.mapping_version     AS axis_version
     , pa.vote_count_used     AS axis_vote_count
  FROM pol
  LEFT JOIN (
      SELECT mona_cd, COUNT(*) AS propose_cnt
        FROM bills
       WHERE mona_cd IS NOT NULL
       GROUP BY mona_cd
  ) b  ON b.mona_cd = pol.mona_cd
  LEFT JOIN (
      SELECT mona_cd, COUNT(*) AS co_propose_cnt
        FROM bill_co_proposers
       WHERE proposer_yn = FALSE
       GROUP BY mona_cd
  ) cp ON cp.mona_cd = pol.mona_cd
  LEFT JOIN politician_axis_score pa
    ON pa.mona_cd = pol.mona_cd AND pa.mapping_version = 'v1'
 ORDER BY pol.name
