/* X레이 ⑤-b 국경 없는 서명러 — 타당 대표발의 법안에 공동발의로 참여한 비율 TOP 10.
   당적은 현재 기준. 공동발의 30건 이상만 */
WITH rep AS (
    SELECT cp.bill_id, MIN(p.party_id) AS rep_party_id
      FROM bill_co_proposers cp
      JOIN politicians p ON p.mona_cd = cp.mona_cd
     WHERE cp.proposer_yn = TRUE
     GROUP BY cp.bill_id
)
SELECT p.mona_cd, p.name, p.party_name, p.photo_url
     , COUNT(*)::int AS co_cnt
     , COUNT(*) FILTER (WHERE p.party_id <> r.rep_party_id)::int AS cross_cnt
  FROM bill_co_proposers cp
  JOIN politicians p ON p.mona_cd = cp.mona_cd
  JOIN rep r ON r.bill_id = cp.bill_id
 WHERE cp.proposer_yn = FALSE AND p.active_yn = TRUE
 GROUP BY p.mona_cd, p.name, p.party_name, p.photo_url
HAVING COUNT(*) >= 30
 ORDER BY (COUNT(*) FILTER (WHERE p.party_id <> r.rep_party_id))::float / COUNT(*) DESC
 LIMIT 10
