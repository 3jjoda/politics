-- 쟁점 후보 신호 ② — 브리핑이 **여러 날 반복해서 뽑은** 주제
--
-- `briefing_posts.threads` 는 AI 가 그날 법안을 읽고 묶은 주제다 (하루 0~3개).
-- 같은 주제가 여러 날 나오면 "지속되는 사안" 이라는 뜻이고 그게 쟁점 후보다.
--
-- 🔴 **지금은 거의 안 나온다.** 실측(2026-08-23) 카드 32건에서 주제가 **전부 1일**이다.
--    카드가 쌓여야 쓸 수 있는 신호라 화면이 "왜 비었는지" 를 문구로 설명한다 —
--    빈 목록을 감추면 조용히 없는 기능이 된다 (/xray 의 빈 지표 처리와 같은 판단).
-- ⚠️ theme 은 AI 가 매일 새로 짓는 자유 문자열이라 **표기가 조금만 달라도 다른 주제로 센다**
--    (`전세사기 지원` vs `전세사기 피해 지원`). 즉 이 숫자는 **과소 계상**이다.
--    정규화를 넣고 싶어지면, 그건 곧 주제 판별이고 이미 실패한 문제라는 걸 먼저 볼 것.
--   $1 최소 등장 일수
SELECT t->>'theme'                                   AS theme,
       COUNT(*)::int                                 AS days,
       SUM(COALESCE((t->>'bill_count')::int, 0))::int AS bills,
       TO_CHAR(MIN(bp.briefing_date), 'YYYY-MM-DD')  AS first_day,
       TO_CHAR(MAX(bp.briefing_date), 'YYYY-MM-DD')  AS last_day
  FROM briefing_posts bp,
       jsonb_array_elements(COALESCE(bp.threads, '[]'::jsonb)) t
 GROUP BY 1
HAVING COUNT(*) >= $1
 ORDER BY days DESC, bills DESC
 LIMIT 20
