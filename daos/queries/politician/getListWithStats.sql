/* 정치인 목록 + 발의 건수 + 필터용 성별/연령대 버킷 */
WITH pol AS (
  SELECT p.*
       , CASE
           WHEN p.birthday IS NULL THEN NULL
           ELSE (
             EXTRACT(YEAR FROM CURRENT_DATE)::int
           - EXTRACT(YEAR FROM p.birthday)::int
           - CASE WHEN TO_CHAR(CURRENT_DATE, 'MMDD') < TO_CHAR(p.birthday, 'MMDD') THEN 1 ELSE 0 END
         )
         END AS age
    FROM politicians p
   /* ⚠️ `active_yn = TRUE` 로 거르지 않는다 (2026-08-14).
      현역 의원 API 에서 빠진 사람(임기 중 사퇴·퇴임 등)이 목록에서 통째로 사라져
      22대에서 실제로 활동한 기록이 있는데도 조회할 방법이 없었다 (실측 10명).
      상세 페이지는 원래부터 열렸는데 목록만 막혀 있어 더 이상했다.
      → 전부 노출하고 화면에서 `(퇴임)` 으로 구분한다.
      ⚠️ 이 페이지의 사이드바 카운트 5종도 같이 풀어야 한다 —
         한쪽만 풀면 "정당 카운트 N" 과 실제 카드 수가 어긋난다. */
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
     /* 교차 표결 성향 격차(%p) — 사전 계산 MV. 정의는 CLAUDE.md 참조.
        in_cohort(자·타당 각 50건 이상) 아니면 NULL → UI 에서 필터 제외·정렬 최후미 */
     , CASE WHEN cpv.in_cohort THEN cpv.gap END AS cpv_gap
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
  LEFT JOIN politician_cross_party_vote cpv
    ON cpv.mona_cd = pol.mona_cd
 ORDER BY pol.name
