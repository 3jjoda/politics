/* 의원 성별 분포 (남 / 여)
   sex_gbn_nm 값이 '남' | '여' 인 의원만 카운트
*/
SELECT COUNT(*) FILTER (WHERE sex_gbn_nm = '남') AS male_cnt
     , COUNT(*) FILTER (WHERE sex_gbn_nm = '여') AS female_cnt
     , COUNT(*)                                  AS total_cnt
  FROM politicians
 WHERE active_yn = TRUE
   AND sex_gbn_nm IN ('남', '여')
