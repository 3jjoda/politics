/* 대표발의가 적은 의원 — **임기 전체 재직자만**.
   🔴 재직 기간을 보정하지 않으면 "지난달 합류해 2건 낸 사람" 이 최하위가 된다. 그건 활동량이 아니라 기간이다.
      `bill_votes` 모수가 곧 재직 기간의 대리 지표다 (그 사람 재직 중 본회의에 올라온 법안 수).
      기준을 상수로 박지 않는다 — 회기가 갈수록 늘어난다. */
WITH mx AS (SELECT MAX(cnt) mx FROM (SELECT COUNT(*) cnt FROM bill_votes GROUP BY mona_cd) t),
full_term AS (
  SELECT p.mona_cd, p.name, p.party_name, p.electoral_district AS district,
         (SELECT COUNT(*) FROM bill_votes v WHERE v.mona_cd = p.mona_cd) AS vtot
    FROM politicians p WHERE p.active_yn
), c AS (
  SELECT f.*, (SELECT COUNT(*) FROM bills b WHERE b.mona_cd = f.mona_cd) AS cnt
    FROM full_term f WHERE f.vtot >= 0.9 * (SELECT mx FROM mx)
), m AS (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cnt) med, COUNT(*) n FROM c)
SELECT c.mona_cd, c.name, c.party_name, c.district,
       c.cnt AS value, c.vtot,
       ROUND((SELECT med FROM m)::numeric, 0) AS median,
       (SELECT n FROM m) AS cohort
  FROM c
 WHERE c.cnt <= $1
 ORDER BY c.cnt ASC, c.mona_cd
