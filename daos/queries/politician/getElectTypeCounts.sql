/* 정치인 선출 방식별 카운트 */
SELECT COALESCE(NULLIF(elect_gbn_nm, ''), '기타') AS elect_gbn_nm
     , COUNT(*) AS cnt
  FROM politicians
 WHERE active_yn = TRUE
 GROUP BY COALESCE(NULLIF(elect_gbn_nm, ''), '기타')
 ORDER BY cnt DESC
