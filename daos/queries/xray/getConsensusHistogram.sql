/* X레이 ① 표결 합의 분포 — 법안별 찬성률(찬반 참여자 기준) 20구간 히스토그램. 표결 30인 이상만 */
WITH per_bill AS (
    SELECT bill_id
         , COUNT(*) FILTER (WHERE vote_result = '찬성')::float AS yes
         , COUNT(*) FILTER (WHERE vote_result = '반대')::float AS no
      FROM bill_votes
     GROUP BY bill_id
)
SELECT width_bucket(yes / (yes + no), 0, 1.0000001, 20) AS bucket
     , COUNT(*)::int AS cnt
  FROM per_bill
 WHERE yes + no >= 30
 GROUP BY bucket
 ORDER BY bucket
