/* X레이 ⑪ 당 성향 격차 — 요약 통계 + 정당별 평균
 *
 * 히스토그램만으로는 "이게 큰 값인가" 판단이 안 되므로 중앙값·사분위를 같이 낸다.
 * 정당별 평균은 해석 주의 근거 — 다수당은 자기 법안이 그냥 통과되는 구조라
 * 격차가 낮게 나오는 경향이 있어, 수치만으로 "당에 덜 치중한다" 고 읽으면 안 된다.
 */
WITH c AS (
    SELECT p.mona_cd, p.party_name, v.gap
      FROM politician_cross_party_vote v
      JOIN politicians p ON p.mona_cd = v.mona_cd
     WHERE v.in_cohort
)
SELECT (SELECT COUNT(*)::int FROM c)                                                    AS total
     , (SELECT ROUND(MIN(gap)::numeric, 1) FROM c)                                      AS gap_min
     , (SELECT ROUND(MAX(gap)::numeric, 1) FROM c)                                      AS gap_max
     , (SELECT ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gap)::numeric, 1) FROM c) AS q1
     , (SELECT ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY gap)::numeric, 1) FROM c) AS median
     , (SELECT ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gap)::numeric, 1) FROM c) AS q3
     -- 격차 2%p 미만 = 사실상 발의 정당을 가리지 않는 의원
     , (SELECT COUNT(*)::int FROM c WHERE gap < 2)                                      AS neutral_cnt
     -- 격차 10%p 이상 = 당 성향이 뚜렷한 의원
     , (SELECT COUNT(*)::int FROM c WHERE gap >= 10)                                    AS partisan_cnt
     , (SELECT json_agg(t ORDER BY t.avg_gap DESC)
          FROM (SELECT party_name
                     , COUNT(*)::int                     AS cnt
                     , ROUND(AVG(gap)::numeric, 1)       AS avg_gap
                  FROM c
                 WHERE party_name IS NOT NULL
                 GROUP BY party_name
                HAVING COUNT(*) >= 3) t)                                                AS by_party
