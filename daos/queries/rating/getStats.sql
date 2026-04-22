/* 의원 별점 통계
   $1 politician_id (mona_cd)
   반환: avg, total, score_1 ~ score_5
*/
SELECT ROUND(AVG(score)::numeric, 2)             AS avg
     , COUNT(*)                                  AS total
     , COUNT(*) FILTER (WHERE score = 1)         AS score_1
     , COUNT(*) FILTER (WHERE score = 2)         AS score_2
     , COUNT(*) FILTER (WHERE score = 3)         AS score_3
     , COUNT(*) FILTER (WHERE score = 4)         AS score_4
     , COUNT(*) FILTER (WHERE score = 5)         AS score_5
  FROM politician_ratings
 WHERE politician_id = $1
