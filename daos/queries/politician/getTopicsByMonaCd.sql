/* 정치인 상세 - 관심분야 TOP 5 (대표발의만) */
SELECT c.code_id
     , c.code_name AS topic_name
     , COUNT(*) AS cnt
  FROM bills b
  JOIN codes c
    ON c.group_code = 'BILL_TOPIC'
   AND c.code_id = b.bill_topic_cd
 WHERE b.mona_cd = $1
 GROUP BY c.code_id, c.code_name
 ORDER BY cnt DESC
 LIMIT 5
