/* 법안 국민 찬반 집계
   $1 bill_id
*/
SELECT COUNT(*) FILTER (WHERE vote = 'agree')    AS agree_cnt
     , COUNT(*) FILTER (WHERE vote = 'disagree') AS disagree_cnt
     , COUNT(*)                                  AS total_cnt
  FROM bill_citizen_votes
 WHERE bill_id = $1
