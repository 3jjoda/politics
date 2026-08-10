/* X레이 ⑧ 국민 vs 국회 — 국민 찬반(3표 이상)과 본회의 표결(찬반 30인 이상)이 모두 있는 법안의 찬성률 격차 TOP 10 */
WITH citizen AS (
    SELECT bill_id
         , COUNT(*) FILTER (WHERE vote = 'agree')::int AS c_agree
         , COUNT(*) FILTER (WHERE vote = 'disagree')::int AS c_disagree
      FROM bill_citizen_votes
     GROUP BY bill_id
    HAVING COUNT(*) >= 3
), assembly AS (
    SELECT bill_id
         , COUNT(*) FILTER (WHERE vote_result = '찬성')::int AS a_yes
         , COUNT(*) FILTER (WHERE vote_result = '반대')::int AS a_no
      FROM bill_votes
     GROUP BY bill_id
    HAVING COUNT(*) FILTER (WHERE vote_result IN ('찬성','반대')) >= 30
)
SELECT b.bill_id, b.bill_name
     , c.c_agree, c.c_disagree, a.a_yes, a.a_no
  FROM citizen c
  JOIN assembly a ON a.bill_id = c.bill_id
  JOIN bills b ON b.bill_id = c.bill_id
 ORDER BY ABS( c.c_agree::float / NULLIF(c.c_agree + c.c_disagree, 0)
             - a.a_yes::float  / NULLIF(a.a_yes + a.a_no, 0) ) DESC
 LIMIT 10
