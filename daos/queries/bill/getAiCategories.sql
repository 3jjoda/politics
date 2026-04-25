/* AI 분석 - 등장한 main 카테고리 + 카운트 (사이드바 "주제별" 옵션용) */
SELECT category_main AS category
     , COUNT(*)::int AS cnt
  FROM bill_ai_analysis
 WHERE category_main IS NOT NULL AND category_main <> ''
 GROUP BY category_main
 ORDER BY cnt DESC, category_main ASC
