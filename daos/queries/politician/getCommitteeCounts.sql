/* 정치인 위원회별 카운트 (cmit_nm 기준) — 미배정은 제외 */
/* ⚠️ 현직(active_yn) 으로 거르지 않는다 — getListWithStats.sql 과 같은 이유.
   한쪽만 풀면 사이드바 카운트와 실제 카드 수가 어긋난다. */
SELECT cmit_nm
     , COUNT(*) AS cnt
  FROM politicians
 WHERE cmit_nm IS NOT NULL
   AND cmit_nm <> ''
 GROUP BY cmit_nm
 ORDER BY cnt DESC
