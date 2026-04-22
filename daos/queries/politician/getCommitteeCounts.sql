/* 정치인 위원회별 카운트 (cmit_nm 기준) */
SELECT COALESCE(NULLIF(cmit_nm, ''), '무소속위') AS cmit_nm
     , COUNT(*) AS cnt
  FROM politicians
 WHERE active_yn = TRUE
 GROUP BY COALESCE(NULLIF(cmit_nm, ''), '무소속위')
 ORDER BY cnt DESC
