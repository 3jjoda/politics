/* 정치인 상세 - 표결 요약 집계 */
SELECT COUNT(*) FILTER (WHERE vote_result = '찬성') AS for_cnt
     , COUNT(*) FILTER (WHERE vote_result = '반대') AS against_cnt
     , COUNT(*) FILTER (WHERE vote_result = '기권') AS abstain_cnt
     , COUNT(*) FILTER (WHERE vote_result = '불참') AS absent_cnt
     , COUNT(*) AS total_cnt
  FROM bill_votes
 WHERE mona_cd = $1
