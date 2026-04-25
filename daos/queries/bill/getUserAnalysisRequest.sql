/* 특정 사용자의 특정 법안 요청 존재 여부 */
SELECT id
  FROM bill_analysis_requests
 WHERE bill_id = $1
   AND user_id = $2
 LIMIT 1
