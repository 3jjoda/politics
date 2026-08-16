/* 정치인 상세 - 대표발의 특화 위원회 TOP 5 (2026-08-16 재작성)

   🔴 **절대 건수만 주지 않는다.** 예전엔 `committee, COUNT(*)` 뿐이었는데,
      그러면 "모두가 많이 내는 위원회" 와 "이 사람이 특별히 파는 위원회" 가 구분되지 않는다.
      실측 윤준병: 농해수위 115건(본인 34.4% / 의원평균 6.5% → **5.3배**) 은 진짜 신호지만,
      2위 행안위 57건은 17.1% vs 13.8% 로 **1.2배**, 법사위는 **0.6배(평균 이하)** 다.
      건수 막대로는 다섯 줄이 같은 무게로 읽혀 그 차이를 말하지 못했다.

   → `lift` = (본인 비중) / (전체 의원 평균 비중). 이게 "어떤 성향의 정치인인가" 에 답하는 축이다.
      실측 분포: 1위 위원회 lift 중앙값 **5.95배**, 315명 중 **269명(85%)이 3배 이상**.

   ⚠️ `base_share` 는 **전 의원 대표발의 전체**에서 그 위원회가 차지하는 비중이다
      (의원 1인 평균이 아니라 법안 풀 기준). 위원회마다 법안 총량이 크게 달라서
      (법사위 9.3% vs 여가위 0.2%) 이 보정 없이는 비교 자체가 성립하지 않는다.
   ⚠️ 순서는 **건수 순**이다. lift 순으로 두면 5건짜리 소규모 위원회가 1위로 올라온다.
   ⚠️ committee 가 빈 값인 법안은 "미지정" 이 아니라 **아직 회부 전**이라 분모에서도 뺀다.

   인자: $1 mona_cd
*/
WITH me AS (
    SELECT b.committee, COUNT(*)::numeric AS cnt
      FROM bills b
     WHERE b.mona_cd = $1
       AND COALESCE(b.committee, '') <> ''
     GROUP BY b.committee
), me_tot AS (
    SELECT SUM(cnt) AS t FROM me
), ov AS (
    SELECT b.committee, COUNT(*)::numeric AS cnt
      FROM bills b
     WHERE b.mona_cd IS NOT NULL
       AND COALESCE(b.committee, '') <> ''
     GROUP BY b.committee
), ov_tot AS (
    SELECT SUM(cnt) AS t FROM ov
)
SELECT me.committee                                   AS topic_name
     , me.cnt::int                                    AS cnt
     , mt.t::int                                      AS own_total
     , ROUND(me.cnt / mt.t * 100, 1)::float8          AS own_share
     , ROUND(ov.cnt / ot.t * 100, 1)::float8          AS base_share
     , ROUND((me.cnt / mt.t) / (ov.cnt / ot.t), 2)::float8 AS lift
  FROM me
  CROSS JOIN me_tot mt
  CROSS JOIN ov_tot ot
  JOIN ov ON ov.committee = me.committee
 ORDER BY me.cnt DESC, me.committee
 LIMIT 5
