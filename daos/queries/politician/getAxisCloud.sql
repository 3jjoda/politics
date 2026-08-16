/* 공유 카드 「좌표 지도」 — 좌표 있는 의원 전원의 3축 값만 (이름·정당 없음). 2026-08-16
   카드에 292명을 회색 점으로 뿌리고 그 사이에 나를 찍는다. 익명 점구름이라 개인 식별·정당 신호가 없다.
   ⚠️ mapping_version='v2' = utils/axisConfig.js POL_MAPPING_VERSION */
SELECT economy::float8, social::float8, institution::float8
  FROM politician_axis_score
 WHERE mapping_version = 'v2'
   AND economy IS NOT NULL AND social IS NOT NULL AND institution IS NOT NULL
