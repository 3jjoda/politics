/* 홈 히어로 — **결론형 숫자 3종** (2026-08-16 신규)

   🔴 구 `getHomeKpi` 의 재고 총량(전체 법안 18,741 · 등록 의원 299 · 표결 177,260)을 대체한다.
      총량은 크기만 말하고 "그래서?" 에 답하지 않는다. 여기 셋은 서로 겹치지 않고
      **하나의 이야기**가 되도록 골랐다 — 법안의 운명 → 표결의 실상 → 참여의 실상:

        ① 계류 75.8%   발의된 법안 4건 중 3건은 위원회에서 결론이 안 났다 (그 절반은 1년 초과)
        ② 반대 0.66%   본회의까지 온 법안에 반대표는 거의 없다 (걸러지는 곳은 위원회)
        ③ 불참 20.7%   그런데 의원 절반은 다섯 번 중 한 번 이상 본회의에 빠진다 (중앙값)

   ⚠️ ③ 은 **의원별 비율의 중앙값**이지 전체 불참 비율(24.75%)이 아니다. 둘을 섞지 말 것 —
      전체 비율은 표결이 많은 의원에게 가중되고, 중앙값이라야 "보통 의원" 을 말한다.
   ⚠️ 모수 100건 미만(중도 합류·퇴임)은 중앙값에서 뺀다. 실측 304명이 남는다.
   ⚠️ 화면에 쓰는 보조 숫자(전체 건수 등)도 같이 낸다 — 비율만 있으면 규모를 알 수 없다.
*/
WITH bill AS (
    SELECT COUNT(*)::int                                              AS total
         , COUNT(*) FILTER (WHERE proc_result_name IS NULL)::int      AS pending
         , COUNT(*) FILTER (WHERE proc_result_name LIKE '%가결%')::int AS passed
         /* 🔴 계류 중 **1년 넘게 결론이 안 난** 건수 (2026-08-25 추가).
            "계류 75%" 만으로는 "그래서?" 에 답하지 못한다 — 아직 심사 중인 것처럼 읽히기 때문이다.
            임기가 끝나면 심사받지 못한 법안은 폐기되므로(헌법 제51조 단서), **얼마나 오래 멈춰 있나**가
            그 숫자의 뜻이다. 실측 계류 14,079건 중 7,501건(53%) · 중앙값 398일 · 최장 817일.
            ⚠️ `propose_dt` 가 없는 행은 자연히 빠진다 (비교가 NULL) */
         , COUNT(*) FILTER (
               WHERE proc_result_name IS NULL
                 AND (CURRENT_DATE - propose_dt) >= 365
           )::int                                                     AS pending_over_1y
      FROM bills
), vote AS (
    SELECT COUNT(*)::int                                        AS total
         , COUNT(*) FILTER (WHERE vote_result = '반대')::int     AS oppose
      FROM bill_votes
), absent AS (
    /* 의원별 불참률의 중앙값. 모수가 얇은 의원은 값이 튀므로 100건 이상만 본다 */
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rate) AS median_rate
         , COUNT(*)::int                                     AS cohort
      FROM (
            SELECT mona_cd
                 , 100.0 * COUNT(*) FILTER (WHERE vote_result = '불참') / COUNT(*) AS rate
              FROM bill_votes
             GROUP BY mona_cd
            HAVING COUNT(*) >= 100
      ) x
)
SELECT b.total                                              AS bill_total
     , b.pending                                            AS bill_pending
     , b.passed                                             AS bill_passed
     , b.pending_over_1y                                    AS bill_pending_over_1y
     , ROUND(100.0 * b.pending / NULLIF(b.total, 0), 1)::float8 AS pending_rate
     , v.total                                              AS vote_total
     , v.oppose                                             AS vote_oppose
     , ROUND(100.0 * v.oppose / NULLIF(v.total, 0), 2)::float8  AS oppose_rate
     , ROUND(a.median_rate::numeric, 1)::float8             AS absent_median
     , a.cohort                                             AS absent_cohort
  FROM bill b, vote v, absent a
