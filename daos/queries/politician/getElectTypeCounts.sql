/* 정치인 선출 방식별 카운트 */
/* ⚠️ 현직(active_yn) 으로 거르지 않는다 — getListWithStats.sql 과 같은 이유.
   한쪽만 풀면 사이드바 카운트와 실제 카드 수가 어긋난다. */
SELECT COALESCE(NULLIF(elect_gbn_nm, ''), '기타') AS elect_gbn_nm
     , COUNT(*) AS cnt
  FROM politicians
 GROUP BY COALESCE(NULLIF(elect_gbn_nm, ''), '기타')
 ORDER BY cnt DESC
