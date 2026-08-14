/* 의원 성별 분포 (남 / 여)
   sex_gbn_nm 값이 '남' | '여' 인 의원만 카운트
*/
/* ⚠️ 현직(active_yn) 으로 거르지 않는다 — getListWithStats.sql 과 같은 이유.
   한쪽만 풀면 사이드바 카운트와 실제 카드 수가 어긋난다. */
SELECT COUNT(*) FILTER (WHERE sex_gbn_nm = '남') AS male_cnt
     , COUNT(*) FILTER (WHERE sex_gbn_nm = '여') AS female_cnt
     , COUNT(*)                                  AS total_cnt
  FROM politicians
 WHERE sex_gbn_nm IN ('남', '여')
