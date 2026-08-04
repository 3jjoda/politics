/* 정치인 상세 — 교차 표결 성향
 *
 * "이 의원이 당을 보고 투표하나, 법안을 보고 투표하나"
 *   자당 발의 법안 찬성률 vs 타당 발의 법안 찬성률, 그리고 그 격차.
 *
 * 집계 본체는 materialized view `politician_cross_party_vote` 에 사전 계산돼 있다.
 * (ddl/migrations/2026-08-05-cross-party-vote-mv.sql · 정의와 근거는 CLAUDE.md 참조)
 * 여기서는 MV 를 읽어 중앙값·순위만 얹는다 — 300행 스캔이라 비용이 없다.
 *
 * $1 = mona_cd
 */
WITH cohort AS (
  SELECT gap FROM politician_cross_party_vote WHERE in_cohort
)
SELECT c.own_total
     , c.other_total
     , c.own_rate
     , c.other_rate
     , c.gap
     , c.dissent_total
     , c.dissent_other
     , c.in_cohort
     , (SELECT COUNT(*) FROM cohort)                                              AS cohort_size
     , (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap)::numeric, 1)
          FROM cohort)                                                            AS cohort_median
     -- 격차가 큰 순으로 몇 등인지 (1 = 가장 당 성향이 뚜렷)
     , CASE WHEN c.in_cohort
            THEN (SELECT COUNT(*) FROM cohort x WHERE x.gap > c.gap) + 1
       END                                                                        AS gap_rank
  FROM politician_cross_party_vote c
 WHERE c.mona_cd = $1
