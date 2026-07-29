/* X레이 ⑩ AI 분석 카테고리 분포 — v4.1 16종 main 기준 */
SELECT category_main, COUNT(*)::int AS cnt
  FROM bill_ai_analysis
 WHERE category_main IS NOT NULL
 GROUP BY category_main
 ORDER BY cnt DESC
