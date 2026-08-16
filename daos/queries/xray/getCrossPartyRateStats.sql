/* X레이 — 자당/타당 찬성률 요약 통계 (분포 옆에 붙는 숫자)
 *
 * 히스토그램만으로는 "폭이 얼마나 다른가" 가 눈대중이라, 범위·표준편차를 숫자로 낸다.
 * 이 섹션의 결론이 바로 그 대비다 — 자당은 좁고 타당은 넓다.
 *
 * ⚠️ under_min 은 60% 미만 인원. 지금은 0 이지만 0 이 아니게 되면 히스토그램이
 *    그 인원을 못 그리므로 화면이 각주로 알려야 한다 (조용히 빠지면 안 된다).
 */
WITH c AS (
    SELECT own_rate, other_rate
      FROM politician_cross_party_vote
     WHERE in_cohort
), floor_b AS (
    /* 법안별 찬성률 (불참 제외 — 위 지표와 같은 기준) */
    SELECT COUNT(*) FILTER (WHERE vote_result = '찬성')::float
         / NULLIF(COUNT(*) FILTER (WHERE vote_result IN ('찬성','반대','기권')), 0) AS r
      FROM bill_votes
     GROUP BY bill_id
    HAVING COUNT(*) FILTER (WHERE vote_result IN ('찬성','반대','기권')) > 0
)
SELECT COUNT(*)::int                                                         AS total
     , ROUND(MIN(own_rate)::numeric,   1)                                    AS own_min
     , ROUND(MAX(own_rate)::numeric,   1)                                    AS own_max
     , ROUND(AVG(own_rate)::numeric,   1)                                    AS own_avg
     , ROUND(STDDEV(own_rate)::numeric, 2)                                   AS own_sd
     , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY own_rate)::numeric, 1)   AS own_median
     , ROUND(MIN(other_rate)::numeric, 1)                                    AS other_min
     , ROUND(MAX(other_rate)::numeric, 1)                                    AS other_max
     , ROUND(AVG(other_rate)::numeric, 1)                                    AS other_avg
     , ROUND(STDDEV(other_rate)::numeric, 2)                                 AS other_sd
     , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY other_rate)::numeric, 1) AS other_median
     -- "자당엔 예외가 거의 없다" 를 뒷받침하는 수치
     , COUNT(*) FILTER (WHERE own_rate   >= 99)::int                         AS own_over99
     , COUNT(*) FILTER (WHERE other_rate >= 99)::int                         AS other_over99
     /* 점 그래프 x축 하한(65%) 밖 — 화면이 왼쪽 끝에 붙여 그리므로 0 이 아니면 각주로 알린다.
        ⚠️ 이 65 는 뷰의 X_MIN 과 **같은 값이어야 한다.** 어긋나면 붙여 그려놓고 알리지 않거나,
           멀쩡한 점을 "범위 밖" 이라고 하게 된다 (현재 실측 최소 66.1% 라 0명) */
     , COUNT(*) FILTER (WHERE own_rate < 65 OR other_rate < 65)::int         AS under_min
     /* 해석 각주용 — "본회의는 이미 걸러진 안건" 근거.
        🔴 화면에 하드코딩하지 말 것. 표결이 쌓이면 값이 움직인다 */
     , (SELECT COUNT(*)::int FROM floor_b)                                   AS floor_bills
     , (SELECT ROUND(AVG(r)::numeric * 100, 1) FROM floor_b)                 AS floor_avg_for
     , (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE vote_result = '반대')
                   / NULLIF(COUNT(*), 0), 2) FROM bill_votes)                AS oppose_pct
  FROM c
