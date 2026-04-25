/* 특정 법안의 분석 요청 수 */
SELECT COUNT(*)::int AS count
  FROM bill_analysis_requests
 WHERE bill_id = $1
