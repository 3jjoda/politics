/* 법안 카테고리(위원회)별 카운트 — 사이드바용 */
SELECT b.committee
     , COUNT(*) AS cnt
  FROM bills b
 WHERE b.committee IS NOT NULL
   AND b.committee <> ''
 GROUP BY b.committee
 ORDER BY cnt DESC
