/* 홈 — 내 좌표와 가장 가까운 의원 TOP N (2026-08-16 신규 · 같은 날 v2 3축으로 전환)

   🔴 일치도 식은 **의원 상세·목록과 글자 그대로 같아야 한다** (utils/balanceDistance.js 가 JS 쪽 단일 소스):
        거리   = sqrt(경제² + 사회² + 제도²) / 2       ← 안보축은 뺀다 (utils/axisConfig.js MATCH_AXES)
        일치도 = max(0, (1 - d/1.5) * 100)
      한 곳만 고치면 홈과 상세가 다른 수를 말한다.

   ⚠️ `mapping_version='v2'` — utils/axisConfig.js POL_MAPPING_VERSION 과 같아야 한다.
   ⚠️ 축 값이 NULL 인 의원(서명 5건 미만)은 WHERE 에서 빠진다.
   ⚠️ **퇴임 의원도 포함한다** — 의원 목록이 active_yn 으로 거르지 않는 것과 같은 판단. 화면에서 `퇴임` 배지로 구분.

   인자: $1 economy · $2 social · $3 institution · $4 limit
*/
SELECT p.mona_cd
     , p.name
     , p.party_name
     , p.photo_url
     , p.electoral_district
     , p.active_yn
     , GREATEST(0, (1 - (
           SQRT( POWER(a.economy     - $1, 2)
               + POWER(a.social      - $2, 2)
               + POWER(a.institution - $3, 2) ) / 2
       ) / 1.5) * 100)::float8 AS match_pct
  FROM politician_axis_score a
  JOIN politicians p ON p.mona_cd = a.mona_cd
 WHERE a.mapping_version = 'v2'
   AND a.economy IS NOT NULL AND a.social IS NOT NULL AND a.institution IS NOT NULL
 ORDER BY match_pct DESC, p.name
 LIMIT $4
