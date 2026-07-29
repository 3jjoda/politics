/* X레이 ⑦ 표결 불참률 TOP 15 — 본회의 표결 기록 100회 이상. 불참 사유(공무·사보임 등)는 미구분 */
SELECT p.mona_cd, p.name, p.party_name, p.photo_url
     , COUNT(*)::int AS total_cnt
     , COUNT(*) FILTER (WHERE bv.vote_result = '불참')::int AS absent_cnt
  FROM bill_votes bv
  JOIN politicians p ON p.mona_cd = bv.mona_cd
 WHERE p.active_yn = TRUE
 GROUP BY p.mona_cd, p.name, p.party_name, p.photo_url
HAVING COUNT(*) >= 100
 ORDER BY (COUNT(*) FILTER (WHERE bv.vote_result = '불참'))::float / COUNT(*) DESC
 LIMIT 15
