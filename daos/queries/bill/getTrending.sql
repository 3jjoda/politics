/* 홈 - 주목할 법안: 최근 가결된 법안 상위 6건
   - 원안가결 / 수정가결만 노출 (철회·폐기·대안반영폐기 제외)
   - bill_name 기준 dedupe: 같은 법안명 중복 시 최신 propose_dt 하나만
   $1: sort — 'recent' | 'close' | 'popular' | 'bipartisan'
*/
WITH unique_bills AS (
  SELECT DISTINCT ON (b.bill_name)
         b.bill_id
       , b.bill_no
       , b.bill_name
       , b.proposer_name
       , b.co_proposer_count
       , b.propose_dt
       , b.proc_result_name
       , b.committee
    FROM bills b
   WHERE b.proc_result_name IN ('원안가결', '수정가결')
     AND b.bill_name IS NOT NULL
     AND b.bill_name <> ''
     AND b.propose_dt IS NOT NULL
   ORDER BY b.bill_name, b.propose_dt DESC, b.bill_id DESC
)
SELECT u.bill_id
     , u.bill_no
     , u.bill_name
     , u.proposer_name
     , u.co_proposer_count
     , TO_CHAR(u.propose_dt, 'YYYY-MM-DD') AS propose_dt
     , u.proc_result_name
     , u.committee AS bill_topic_nm
     , COALESCE(v.for_cnt, 0)     AS vote_for
     , COALESCE(v.against_cnt, 0) AS vote_against
     , COALESCE(v.abstain_cnt, 0) AS vote_abstain
     , COALESCE(v.total_cnt, 0)   AS vote_total
  FROM unique_bills u
  LEFT JOIN (
      SELECT bill_id
           , COUNT(*) FILTER (WHERE vote_result = '찬성') AS for_cnt
           , COUNT(*) FILTER (WHERE vote_result = '반대') AS against_cnt
           , COUNT(*) FILTER (WHERE vote_result IN ('기권','불참')) AS abstain_cnt
           , COUNT(*)                                               AS total_cnt
        FROM bill_votes
       GROUP BY bill_id
  ) v ON v.bill_id = u.bill_id
 ORDER BY
   /* 박빙: 찬반 차이 작은 순 (표결 있는 법안만 유효 → ABS 없으면 NULLS LAST) */
   CASE WHEN $1 = 'close' AND v.total_cnt > 0
        THEN ABS(COALESCE(v.for_cnt, 0) - COALESCE(v.against_cnt, 0))
   END ASC NULLS LAST,
   /* 많은 동참 / 여야 협력 (임시 co_proposer_count 기준) */
   CASE WHEN $1 IN ('popular', 'bipartisan')
        THEN u.co_proposer_count
   END DESC NULLS LAST,
   /* 기본: 최근 가결 순 */
   u.propose_dt DESC, u.bill_id DESC
 LIMIT 6
