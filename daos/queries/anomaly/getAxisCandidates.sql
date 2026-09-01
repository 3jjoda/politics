/* 소속 정당 평균에서 먼 의원 — 경제축 기준.
   🔴 이 지표가 "당 말고 사람" 에 가장 가깝다. 같은 당인데 다른 자리에 서 있다는 뜻이라서다.
   ⚠️ 좌표 있는 의원이 20명 미만인 정당은 뺀다 — 평균이 한두 사람에게 끌려간다. */
WITH a AS (
  SELECT s.mona_cd, p.name, p.party_name, p.electoral_district AS district, s.economy,
         AVG(s.economy) OVER (PARTITION BY p.party_name) AS pavg,
         COUNT(*)       OVER (PARTITION BY p.party_name) AS pn
    FROM politician_axis_score s
    JOIN politicians p ON p.mona_cd = s.mona_cd
   WHERE s.mapping_version = 'v2' AND s.economy IS NOT NULL AND p.active_yn
), d AS (SELECT a.*, ABS(a.economy - a.pavg) AS dist FROM a WHERE a.pn >= 20),
m AS (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dist) med, COUNT(*) n FROM d)
SELECT d.mona_cd, d.name, d.party_name, d.district,
       ROUND(d.dist::numeric, 2)    AS value,
       ROUND(d.economy::numeric, 2) AS me,
       ROUND(d.pavg::numeric, 2)    AS pavg,
       d.pn,
       ROUND((SELECT med FROM m)::numeric, 2) AS median,
       (SELECT n FROM m) AS cohort
  FROM d
 WHERE d.dist >= $1
 ORDER BY d.dist DESC, d.mona_cd
