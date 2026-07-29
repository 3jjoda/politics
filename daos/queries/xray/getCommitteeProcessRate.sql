/* X레이 ④-b 위원회별 처리율 — 접수 100건 이상 위원회, 처리율 내림차순 */
SELECT committee
     , COUNT(*)::int AS total
     , COUNT(*) FILTER (WHERE proc_result_name IS NOT NULL AND proc_result_name <> '')::int AS processed
  FROM bills
 WHERE committee IS NOT NULL AND committee <> ''
 GROUP BY committee
HAVING COUNT(*) >= 100
 ORDER BY (COUNT(*) FILTER (WHERE proc_result_name IS NOT NULL AND proc_result_name <> ''))::float / COUNT(*) DESC
