/* 정치인 상세 — 교차 표결 성향
 *
 * "이 의원이 당을 보고 투표하나, 법안을 보고 투표하나"
 *   자당 발의 법안 찬성률 vs 타당 발의 법안 찬성률, 그리고 그 격차.
 *
 * 설계 노트
 *  · 불참 제외 — 출석해서 의사표시한 건만 모수로 삼는다.
 *    (불참을 넣으면 출석률 낮은 의원의 찬성률이 함께 깎여 지표가 오염된다)
 *  · 발의 정당 = bills.mona_cd → politicians.party_name (대표발의자 기준).
 *    대표발의자 미상(위원장 대안 등)은 자당/타당 판정이 불가하므로 제외.
 *  · 격차만으로는 독자가 크기를 가늠할 수 없어 전체 의원 대비 백분위를 같이 낸다.
 *    표본이 적으면 격차가 요동치므로 자당·타당 각각 50건 이상인 의원만 모집단에 포함.
 *
 * $1 = mona_cd
 */
WITH v AS (
  SELECT bv.mona_cd
       , bv.vote_result
       , me.party_name AS my_party
       , pr.party_name AS proposer_party
    FROM bill_votes bv
    JOIN politicians me ON me.mona_cd = bv.mona_cd
    JOIN bills       b  ON b.bill_id  = bv.bill_id
    JOIN politicians pr ON pr.mona_cd = b.mona_cd      -- 대표발의자 미상 제외
   WHERE bv.vote_result IN ('찬성', '반대', '기권')     -- 불참 제외
     AND me.party_name IS NOT NULL
), agg AS (
  SELECT mona_cd
       , COUNT(*) FILTER (WHERE proposer_party =  my_party)                          AS own_total
       , COUNT(*) FILTER (WHERE proposer_party <> my_party)                          AS other_total
       , COUNT(*) FILTER (WHERE proposer_party =  my_party AND vote_result = '찬성') AS own_for
       , COUNT(*) FILTER (WHERE proposer_party <> my_party AND vote_result = '찬성') AS other_for
       -- 반대·기권(= 명시적 이견)이 어느 쪽 법안을 향하는가
       , COUNT(*) FILTER (WHERE vote_result IN ('반대','기권'))                       AS dissent_total
       , COUNT(*) FILTER (WHERE vote_result IN ('반대','기권')
                            AND proposer_party <> my_party)                          AS dissent_other
    FROM v GROUP BY mona_cd
), rate AS (
  SELECT *
       , ROUND(100.0 * own_for   / NULLIF(own_total,   0), 1) AS own_rate
       , ROUND(100.0 * other_for / NULLIF(other_total, 0), 1) AS other_rate
    FROM agg
), gap AS (
  SELECT *, (own_rate - other_rate) AS gap
    FROM rate
   WHERE own_total >= 50 AND other_total >= 50          -- 백분위 모집단 조건
)
SELECT r.own_total
     , r.other_total
     , r.own_rate
     , r.other_rate
     , (r.own_rate - r.other_rate)                                   AS gap
     , r.dissent_total
     , r.dissent_other
     , (SELECT COUNT(*) FROM gap)                                    AS cohort_size
     , (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap)::numeric, 1) FROM gap)
                                                                     AS cohort_median
     -- 격차가 큰 순으로 몇 등인지 (1 = 가장 당 성향이 뚜렷). 모집단 미달이면 NULL
     , (SELECT COUNT(*) FROM gap g WHERE g.gap > (r.own_rate - r.other_rate)) + 1
                                                                     AS gap_rank
     , (r.own_total >= 50 AND r.other_total >= 50)                   AS in_cohort
  FROM rate r
 WHERE r.mona_cd = $1
