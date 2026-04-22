/* 정치인 상세 - 관심분야 TOP 5 (대표발의 위원회 기준) */
SELECT b.committee AS topic_name
     , COUNT(*)   AS cnt
  FROM bills b
 WHERE b.mona_cd = $1
   AND b.committee IS NOT NULL
   AND b.committee <> ''
 GROUP BY b.committee
 ORDER BY cnt DESC
 LIMIT 5
