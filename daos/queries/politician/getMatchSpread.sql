/* 성향 진단 「의원과 비교」 (2026-08-16) — 내 좌표(3축) 기준으로
     ① 가장 가까운 N명 + 가장 먼 N명 (축 값 포함 — 화면이 막대 위에 두 점을 그린다)
     ② 좌표 있는 의원 수 · 의원 전체 축 평균 · 축별로 "나보다 오른쪽(+)인 의원 수"  ← 모든 행에 같은 값

   🔴 거리 식은 utils/balanceDistance.js · getTopMatches.sql 과 글자 그대로 같다 (3축, /2). 축을 바꾸면 같이.
   ⚠️ `mapping_version='v2'` = utils/axisConfig.js POL_MAPPING_VERSION. 축 값 NULL(서명 5건 미만)인 의원은 빠진다.
   ⚠️ 퇴임 의원도 포함한다 (의원 목록·홈과 같은 판단). 화면에서 `퇴임` 로 구분.
   ⚠️ % 는 내지 않는다 — 화면은 순위(N명 중 M위)만 쓴다 (CLAUDE.md 「성향 일치도 로직 점검」).

   인자: $1 economy · $2 social · $3 institution · $4 limit (양쪽 각각) */
WITH s AS (
    SELECT p.mona_cd, p.name, p.electoral_district, p.active_yn, p.photo_url
         , a.economy, a.social, a.institution
         , SQRT( POWER(a.economy     - $1, 2)
               + POWER(a.social      - $2, 2)
               + POWER(a.institution - $3, 2) ) / 2 AS d
      FROM politician_axis_score a
      JOIN politicians p ON p.mona_cd = a.mona_cd
     WHERE a.mapping_version = 'v2'
       AND a.economy IS NOT NULL AND a.social IS NOT NULL AND a.institution IS NOT NULL
), r AS (
    SELECT s.*
         , ROW_NUMBER() OVER (ORDER BY d ASC,  name)                     AS rank_near
         , ROW_NUMBER() OVER (ORDER BY d DESC, name)                     AS rank_far
         , COUNT(*)            OVER ()                                    AS total
         , AVG(economy)        OVER ()                                    AS avg_economy
         , AVG(social)         OVER ()                                    AS avg_social
         , AVG(institution)    OVER ()                                    AS avg_institution
         , COUNT(*) FILTER (WHERE economy     > $1) OVER ()               AS right_economy
         , COUNT(*) FILTER (WHERE social      > $2) OVER ()               AS right_social
         , COUNT(*) FILTER (WHERE institution > $3) OVER ()               AS right_institution
      FROM s
)
SELECT mona_cd, name, electoral_district, active_yn, photo_url
     , economy::float8, social::float8, institution::float8, d::float8
     , rank_near::int, rank_far::int, total::int
     , avg_economy::float8, avg_social::float8, avg_institution::float8
     , right_economy::int, right_social::int, right_institution::int
  FROM r
 WHERE rank_near <= $4 OR rank_far <= $4
 ORDER BY d ASC, name
