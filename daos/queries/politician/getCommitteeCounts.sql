/* 정치인 위원회별 카운트 (cmit_nm 기준) — 미배정은 제외 */
SELECT cmit_nm
     , COUNT(*) AS cnt
  FROM politicians
 WHERE active_yn = TRUE
   AND cmit_nm IS NOT NULL
   AND cmit_nm <> ''
 GROUP BY cmit_nm
 ORDER BY cnt DESC
