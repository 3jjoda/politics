/* 정치인 정당별 카운트 */
SELECT COALESCE(party_name, '기타/무소속') AS party_name
     , COUNT(*) AS cnt
  FROM politicians
 WHERE active_yn = TRUE
 GROUP BY COALESCE(party_name, '기타/무소속')
 ORDER BY cnt DESC
