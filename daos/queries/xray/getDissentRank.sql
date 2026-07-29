/* X레이 ② 소신 표결 (당론 이탈) — 소속당 다수 입장과 다르게 투표한 비율 TOP 15.
   당적은 현재 기준 (표결 당시 당적 아님), 정당별 유효 표결 10인·개인 유효 표결 50회 이상 */
WITH party_dir AS (
    SELECT bv.bill_id, p.party_id
         , COUNT(*) FILTER (WHERE bv.vote_result = '찬성')::int AS yes
         , COUNT(*) FILTER (WHERE bv.vote_result = '반대')::int AS no
      FROM bill_votes bv
      JOIN politicians p ON p.mona_cd = bv.mona_cd
     WHERE bv.vote_result IN ('찬성','반대')
     GROUP BY bv.bill_id, p.party_id
), majority AS (
    SELECT bill_id, party_id
         , CASE WHEN yes > no THEN '찬성' WHEN no > yes THEN '반대' END AS majority_vote
      FROM party_dir
     WHERE yes + no >= 10 AND yes <> no
)
SELECT p.mona_cd, p.name, p.party_name, p.photo_url
     , COUNT(*)::int AS votes_cnt
     , COUNT(*) FILTER (WHERE bv.vote_result <> m.majority_vote)::int AS dissent_cnt
  FROM bill_votes bv
  JOIN politicians p ON p.mona_cd = bv.mona_cd
  JOIN majority m ON m.bill_id = bv.bill_id AND m.party_id = p.party_id
 WHERE bv.vote_result IN ('찬성','반대')
 GROUP BY p.mona_cd, p.name, p.party_name, p.photo_url
HAVING COUNT(*) >= 50
 ORDER BY (COUNT(*) FILTER (WHERE bv.vote_result <> m.majority_vote))::float / COUNT(*) DESC
 LIMIT 15
