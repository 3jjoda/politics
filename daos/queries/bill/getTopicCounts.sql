/* 법안 카테고리별 카운트 (사이드바용) */
SELECT b.bill_topic_cd
     , c.code_name AS topic_name
     , COUNT(*)   AS cnt
  FROM bills b
  LEFT JOIN codes c
    ON c.group_code = 'BILL_TOPIC'
   AND c.code_id = b.bill_topic_cd
 GROUP BY b.bill_topic_cd, c.code_name
 ORDER BY cnt DESC
