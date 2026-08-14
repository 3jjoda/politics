/* 정치인 정당별 카운트 */
/* ⚠️ 현직(active_yn) 으로 거르지 않는다 — getListWithStats.sql 과 같은 이유.
   한쪽만 풀면 사이드바 카운트와 실제 카드 수가 어긋난다. */
SELECT COALESCE(party_name, '기타/무소속') AS party_name
     , COUNT(*) AS cnt
  FROM politicians
 GROUP BY COALESCE(party_name, '기타/무소속')
 ORDER BY cnt DESC
