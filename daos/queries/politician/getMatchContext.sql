/* 「나와의 성향 일치」 — **순위와 축별 변별력** (2026-08-16 신규 · 같은 날 v2 3축으로 전환)

   🔴 왜 순위인가 — 절대 일치도 %는 분모 1.5 라는 **임의 보정값**에 의존한다. 순위는 거리의 단조 변환이라
      그 보정과 무관하다. 지금 데이터로 정직하게 말할 수 있는 건 순위까지다.

   🔴 v2 (2026-08-16): 좌표가 **공동발의 × 방향 매핑 4,854건 · 3축**이다.
      · 안보축은 없다 — `자주` 방향 법안이 코퍼스 전체에 59건뿐이라 입법 기록으로 잴 수 없다.
        거리에서 빼고, 화면은 이유를 쓴다 (utils/axisConfig.js UNMEASURED_REASON).
      · 거리 = sqrt(경제²+사회²+제도²)/2. **utils/balanceDistance.js · getTopMatches.sql · balanceGame 미들웨어와 같은 식**이어야 한다.
      · 축 값이 NULL 인 의원(서명 5건 미만)은 거리를 못 내므로 모집단에서 빠진다.

   ⚠️ `spread` 는 축별 **변별력**(최빈값 비중). v1 안보축이 0.84 였던 것을 잡던 장치 — v2 는 전부 0.05 미만이지만
      매핑이 바뀌면 다시 커질 수 있어 남긴다.
   ⚠️ 모집단은 좌표가 있는 의원 전체다 (퇴임 포함). 의원 목록이 active_yn 으로 안 거르는 것과 같은 판단.

   인자: $1 economy · $2 social · $3 institution · $4 mona_cd
*/
WITH d AS (
    SELECT a.mona_cd
         , SQRT( POWER(a.economy     - $1, 2)
               + POWER(a.social      - $2, 2)
               + POWER(a.institution - $3, 2) ) / 2 AS dist
      FROM politician_axis_score a
     WHERE a.mapping_version = 'v2'
       AND a.economy IS NOT NULL AND a.social IS NOT NULL AND a.institution IS NOT NULL
), ranked AS (
    SELECT mona_cd, dist, RANK() OVER (ORDER BY dist) AS rnk, COUNT(*) OVER () AS cohort
      FROM d
), spread AS (
    SELECT 'economy' AS axis, MAX(c)::float8 / SUM(c) AS mode_share
      FROM (SELECT COUNT(*) c FROM politician_axis_score WHERE mapping_version='v2' AND economy IS NOT NULL GROUP BY economy) x
    UNION ALL SELECT 'social', MAX(c)::float8 / SUM(c)
      FROM (SELECT COUNT(*) c FROM politician_axis_score WHERE mapping_version='v2' AND social IS NOT NULL GROUP BY social) x
    UNION ALL SELECT 'institution', MAX(c)::float8 / SUM(c)
      FROM (SELECT COUNT(*) c FROM politician_axis_score WHERE mapping_version='v2' AND institution IS NOT NULL GROUP BY institution) x
)
SELECT r.rnk::int                                        AS rank
     , r.cohort::int                                     AS cohort
     , r.dist::float8                                    AS distance
     , (SELECT mode_share FROM spread WHERE axis='economy')::float8     AS spread_economy
     , (SELECT mode_share FROM spread WHERE axis='social')::float8      AS spread_social
     , NULL::float8                                                     AS spread_security   -- 측정 안 함
     , (SELECT mode_share FROM spread WHERE axis='institution')::float8 AS spread_institution
     , (SELECT COUNT(DISTINCT bill_id)::int FROM bill_axis_mapping WHERE mapping_version='v2') AS mapped_bills
     /* 축별 매핑 법안 수 — 화면이 "이 축은 법안 몇 건으로 만들었나" 를 축마다 쓴다 (안보가 왜 없는지의 대조군) */
     , (SELECT COUNT(*)::int FROM bill_axis_mapping WHERE mapping_version='v2' AND axis='economy')     AS mapped_economy
     , (SELECT COUNT(*)::int FROM bill_axis_mapping WHERE mapping_version='v2' AND axis='social')      AS mapped_social
     , (SELECT COUNT(*)::int FROM bill_axis_mapping WHERE mapping_version='v2' AND axis='institution') AS mapped_institution
  FROM ranked r
 WHERE r.mona_cd = $4
