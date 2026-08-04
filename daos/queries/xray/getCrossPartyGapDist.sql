/* X레이 ⑪ 당 성향 격차 분포
 *
 * 의원별 "자당 발의 법안 찬성률 − 타당 발의 법안 찬성률(%p)" 의 전체 분포.
 * 의원 상세의 "266명 중 42위" 가 어떤 모집단 위에서 나온 순위인지 보여주는 배경.
 *
 * 집계 본체는 materialized view politician_cross_party_vote 에 사전 계산돼 있다
 * (ddl/migrations/2026-08-05-cross-party-vote-mv.sql · 정의는 CLAUDE.md 참조).
 * 여기서는 2%p 폭으로 버킷팅만 한다 — 300행 스캔이라 비용 없음.
 *
 * 버킷: -2 미만을 0번, 이후 2%p 씩, 32 이상을 마지막에 몰아넣는다.
 *       실측 범위가 -1.2 ~ 30.9 라 -2 ~ 32 구간이면 전부 담긴다.
 */
WITH c AS (
    SELECT mona_cd, gap
      FROM politician_cross_party_vote
     WHERE in_cohort                       -- 자·타당 각 50건 이상만 (표본 적으면 격차가 요동침)
)
SELECT width_bucket(gap, -2, 32, 17)::int AS bucket   -- 2%p 폭 17구간
     , COUNT(*)::int                      AS cnt
     , ROUND(MIN(gap)::numeric, 1)        AS bucket_min
     , ROUND(MAX(gap)::numeric, 1)        AS bucket_max
  FROM c
 GROUP BY bucket
 ORDER BY bucket
