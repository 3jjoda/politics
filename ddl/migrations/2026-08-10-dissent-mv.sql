-- 2026-08-10 당론 이탈(소신 표결) 사전 계산 (materialized view)
--
-- 배경: X레이 ② 소신 표결 쿼리(getDissentRank)가 **1,410ms** 로 페이지 최대 병목이었다.
--       X레이 14개 쿼리는 Promise.all 병렬이라 가장 느린 하나가 TTFB 를 지배한다
--       (측정: TTFB 2.3초, 이 쿼리 1.41초 / 나머지 13개는 47~395ms).
--       bill_votes 177,260행을 두 번 훑는 구조(party_dir → majority → 본 집계)라
--       표결이 쌓일수록 더 나빠진다.
-- 판단: 값은 syncVotes 가 도는 하루 1회만 바뀐다 → politician_cross_party_vote 와 같은 패턴으로 MV.
--
-- 지표 정의 (기존 쿼리 그대로 승계)
--   · 당론 = 같은 법안·같은 정당에서 찬성/반대 중 다수 쪽. 유효 표결 10인 미만이거나 동수면 제외
--   · 당적은 **현재 기준** (표결 당시 당적이 아님) — politicians.party_id 를 씀
--   · 기권·불참 제외. 찬성/반대만 모수
--   · 개인 유효 표결 50회 이상만 (표본 적으면 이탈률이 요동침)
--
-- ⚠️ 이름·정당·사진은 MV 에 넣지 않고 조회 시 politicians 와 JOIN 한다.
--    MV 에 구우면 의원 정보가 바뀌어도 REFRESH 전까지 옛 값이 남는다 (299행 JOIN 은 비용 없음).
--    politician_cross_party_vote 와 같은 원칙.

DROP MATERIALIZED VIEW IF EXISTS politician_dissent;

CREATE MATERIALIZED VIEW politician_dissent AS
WITH party_dir AS (
    SELECT bv.bill_id, p.party_id
         , COUNT(*) FILTER (WHERE bv.vote_result = '찬성')::int AS yes
         , COUNT(*) FILTER (WHERE bv.vote_result = '반대')::int AS no
      FROM bill_votes bv
      JOIN politicians p ON p.mona_cd = bv.mona_cd
     WHERE bv.vote_result IN ('찬성','반대')
     GROUP BY bv.bill_id, p.party_id
), majority AS (
    SELECT bill_id, party_id
         , CASE WHEN yes > no THEN '찬성' WHEN no > yes THEN '반대' END AS majority_vote
      FROM party_dir
     WHERE yes + no >= 10 AND yes <> no
)
SELECT p.mona_cd
     , COUNT(*)::int                                                    AS votes_cnt
     , COUNT(*) FILTER (WHERE bv.vote_result <> m.majority_vote)::int   AS dissent_cnt
     , ((COUNT(*) FILTER (WHERE bv.vote_result <> m.majority_vote))::float8
        / NULLIF(COUNT(*), 0))                                          AS dissent_rate
  FROM bill_votes bv
  JOIN politicians p ON p.mona_cd = bv.mona_cd
  JOIN majority    m ON m.bill_id = bv.bill_id AND m.party_id = p.party_id
 WHERE bv.vote_result IN ('찬성','반대')
 GROUP BY p.mona_cd
HAVING COUNT(*) >= 50;

-- REFRESH ... CONCURRENTLY 를 쓰려면 UNIQUE 인덱스가 필수 (갱신 중 조회가 안 막힘)
CREATE UNIQUE INDEX ux_politician_dissent_mona_cd ON politician_dissent (mona_cd);
-- TOP N 정렬용
CREATE INDEX idx_politician_dissent_rate ON politician_dissent (dissent_rate DESC);
