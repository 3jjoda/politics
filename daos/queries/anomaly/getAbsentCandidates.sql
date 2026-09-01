/* 본회의 불참률 후보 — 모수 100건 이상.
   ⚠️ 중앙값은 **의원별 비율의 중앙값**이지 전체 불참 비율이 아니다.
      전체 비율은 표결이 많은 의원에게 가중된다 (홈 결론 3숫자와 같은 규칙). */
WITH v AS (
  SELECT p.mona_cd, p.name, p.party_name, p.electoral_district AS district,
         COUNT(*)                                        AS total,
         SUM((bv.vote_result = '불참')::int)             AS absent,
         100.0 * SUM((bv.vote_result = '불참')::int) / COUNT(*) AS rate
    FROM politicians p
    JOIN bill_votes bv ON bv.mona_cd = p.mona_cd
   WHERE p.active_yn
   GROUP BY p.mona_cd, p.name, p.party_name, p.electoral_district
  HAVING COUNT(*) >= 100
), m AS (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rate) med FROM v)
SELECT v.mona_cd, v.name, v.party_name, v.district,
       ROUND(v.rate::numeric, 1)  AS value,
       v.total, v.absent,
       ROUND((SELECT med FROM m)::numeric, 1) AS median,
       (SELECT COUNT(*) FROM v)   AS cohort
  FROM v
 WHERE v.rate >= $1
 ORDER BY v.rate DESC, v.mona_cd
