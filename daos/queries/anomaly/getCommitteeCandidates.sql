/* 상임위 회의 참여율 후보. MV `politician_committee_speech` 를 읽는다.
   ⚠️ `in_cohort` 가 분모 11개 이상·비겸직·비의장단 조건을 이미 담고 있다.
      분모가 얇으면 중앙값이 100% 가 된다 ("첫 회의는 정의상 발언한 회의"). */
WITH m AS (SELECT AVG(rate) avg, COUNT(*) n FROM politician_committee_speech WHERE in_cohort)
SELECT s.mona_cd, p.name, p.party_name, p.electoral_district AS district,
       ROUND(s.rate::numeric, 1) AS value,
       s.dept_nm, s.spoke, s.denom,
       (SELECT COUNT(*) FROM politician_committees pc WHERE pc.mona_cd = s.mona_cd) AS ncmt,
       ROUND((SELECT avg FROM m)::numeric, 1) AS median,
       (SELECT n FROM m) AS cohort
  FROM politician_committee_speech s
  JOIN politicians p ON p.mona_cd = s.mona_cd
 WHERE s.in_cohort AND s.rate <= $1 AND p.active_yn
 ORDER BY s.rate ASC, s.mona_cd
