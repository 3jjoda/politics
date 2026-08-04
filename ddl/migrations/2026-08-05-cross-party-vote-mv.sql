-- 2026-08-05 교차 표결 성향 사전 계산 (materialized view)
--
-- 배경: 의원 목록에 격차 필터·정렬을 붙이려면 299명 전원의 격차가 필요한데,
--       매 요청마다 bill_votes 177,260행을 집계하면 목록 쿼리가 88ms → 180ms 로 늘어난다.
--       bill_votes 는 계속 증가하므로 시간이 갈수록 나빠진다.
-- 판단: 이 값은 syncVotes/syncBills 가 도는 하루 1회만 바뀐다 → 사전 계산이 맞다.
--       politician_axis_score(calcPoliticianAxis.js) 와 같은 패턴이지만,
--       순수 집계라 별도 배치 스크립트 없이 REFRESH 한 줄로 끝나 MV 를 택했다.
--
-- 지표 정의는 CLAUDE.md "교차 표결 성향" 참조.
--   · 불참 제외 — 넣으면 출석률 낮은 의원의 찬성률이 같이 깎여 "당 성향"과 "성실성"이 섞인다
--   · 대표발의자 미상(위원장 대안 등) 제외 — 자당/타당 판정 불가
--   · in_cohort = 자당·타당 각 50건 이상. 표본이 적으면 격차가 요동쳐 순위 모집단에서 뺀다

DROP MATERIALIZED VIEW IF EXISTS politician_cross_party_vote;

CREATE MATERIALIZED VIEW politician_cross_party_vote AS
WITH v AS (
  SELECT bv.mona_cd
       , bv.vote_result
       , me.party_name AS my_party
       , pr.party_name AS proposer_party
    FROM bill_votes bv
    JOIN politicians me ON me.mona_cd = bv.mona_cd
    JOIN bills       b  ON b.bill_id  = bv.bill_id
    JOIN politicians pr ON pr.mona_cd = b.mona_cd
   WHERE bv.vote_result IN ('찬성', '반대', '기권')
     AND me.party_name IS NOT NULL
), agg AS (
  SELECT mona_cd
       , COUNT(*) FILTER (WHERE proposer_party =  my_party)                          AS own_total
       , COUNT(*) FILTER (WHERE proposer_party <> my_party)                          AS other_total
       , COUNT(*) FILTER (WHERE proposer_party =  my_party AND vote_result = '찬성') AS own_for
       , COUNT(*) FILTER (WHERE proposer_party <> my_party AND vote_result = '찬성') AS other_for
       , COUNT(*) FILTER (WHERE vote_result IN ('반대','기권'))                       AS dissent_total
       , COUNT(*) FILTER (WHERE vote_result IN ('반대','기권')
                            AND proposer_party <> my_party)                          AS dissent_other
    FROM v GROUP BY mona_cd
)
SELECT mona_cd
     , own_total::int
     , other_total::int
     , dissent_total::int
     , dissent_other::int
     , ROUND(100.0 * own_for   / NULLIF(own_total,   0), 1)::float8 AS own_rate
     , ROUND(100.0 * other_for / NULLIF(other_total, 0), 1)::float8 AS other_rate
     , (ROUND(100.0 * own_for   / NULLIF(own_total,   0), 1)
      - ROUND(100.0 * other_for / NULLIF(other_total, 0), 1))::float8 AS gap
     , (own_total >= 50 AND other_total >= 50) AS in_cohort
  FROM agg;

-- REFRESH ... CONCURRENTLY 를 쓰려면 UNIQUE 인덱스가 필요하다
-- (CONCURRENTLY 여야 갱신 중에도 목록 페이지가 안 막힌다)
CREATE UNIQUE INDEX ux_pcpv_mona_cd ON politician_cross_party_vote (mona_cd);
CREATE INDEX idx_pcpv_gap ON politician_cross_party_vote (gap) WHERE in_cohort;

COMMENT ON MATERIALIZED VIEW politician_cross_party_vote IS
  '의원별 자당/타당 발의 법안 찬성률과 격차. batch/refreshCrossPartyVote.js 가 매일 갱신.';

-- 최초 1회 채우기
REFRESH MATERIALIZED VIEW politician_cross_party_vote;
