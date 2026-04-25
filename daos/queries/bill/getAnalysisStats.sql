/* 진행률 카운터 — 전체 / 분석 완료 (천천히 변함, 5분 캐시 OK)
   bills 16k+ COUNT(*) 가 무거우므로 캐시 가치 큼.
*/
SELECT
  (SELECT COUNT(*)::int FROM bills)            AS total_bills,
  (SELECT COUNT(*)::int FROM bill_ai_analysis) AS analyzed_bills
