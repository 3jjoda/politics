/* 분석 요청 카운트 — 미분석 법안 중 요청 1명+ / 임계값+
   카드 카운트와 실제 필터 결과(has_analysis=N + request_status=X) 가 일치하도록
   분석된 법안은 제외.
   $1: priority threshold (예: 5)
*/
SELECT
  (SELECT COUNT(*)::int
     FROM bill_analysis_request_counts rc
     LEFT JOIN bill_ai_analysis a ON a.bill_id = rc.bill_id
    WHERE rc.request_count >= 1
      AND a.bill_id IS NULL) AS request_any_bills,
  (SELECT COUNT(*)::int
     FROM bill_analysis_request_counts rc
     LEFT JOIN bill_ai_analysis a ON a.bill_id = rc.bill_id
    WHERE rc.request_count >= $1
      AND a.bill_id IS NULL) AS request_priority_bills
