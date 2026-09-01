/* 자당·타당 찬성률 격차 후보. MV `politician_cross_party_vote` 를 읽는다 (300행이라 비용 없음).
   ⚠️ `in_cohort` 는 자당·타당 표결이 각각 50건 이상인 의원만이다. 표본이 적으면 격차가 요동친다. */
WITH m AS (
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap) med, COUNT(*) n
    FROM politician_cross_party_vote WHERE in_cohort
)
SELECT c.mona_cd, p.name, p.party_name, p.electoral_district AS district,
       ROUND(c.gap::numeric, 1)        AS value,
       ROUND(c.own_rate::numeric, 1)   AS own_rate,
       ROUND(c.other_rate::numeric, 1) AS other_rate,
       c.own_total, c.other_total,
       ROUND((SELECT med FROM m)::numeric, 1) AS median,
       (SELECT n FROM m)               AS cohort
  FROM politician_cross_party_vote c
  JOIN politicians p ON p.mona_cd = c.mona_cd
 WHERE c.in_cohort AND c.gap >= $1 AND p.active_yn
 ORDER BY c.gap DESC, c.mona_cd
