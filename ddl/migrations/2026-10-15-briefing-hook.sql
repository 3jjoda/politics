-- 2026-10-15 — 브리핑 카드 「훅」 컬럼
--
-- SNS 카드 표지를 뉴스카드형(사람 사진 + 질문형 한 문장)으로 바꾸면서 생겼다.
-- 구 표지의 headline 은 그날 요약이라 "장애학생 체육 기반, 세제 정비, 한글날 기념 법령 정비 등
-- 다양한 분야 입법" 처럼 리스트로 뭉쳐 SNS 에서 아무도 멈추지 않았다 (사용자 피드백 2026-10-15).
-- hook 은 **그날 흐름(thread) 하나**를 보통 사람의 질문 한 문장으로 옮긴 것이다.
--
-- 형태 (genBriefing.js 가 채운다. AI 문장 + 코드 산출값의 혼합):
--   { "text": "특수학교엔 왜 운동부가 없을까",   ← AI 문장 (금지어·기간 검사를 headline 과 같이 통과해야 저장)
--     "theme": "법령 용어 정비",                 ← 그 흐름의 theme (AI, threads 와 동일)
--     "bill_count": 3,                           ← 코드가 센 값 (AI 가 센 값 아님 — threads 와 같은 원칙)
--     "bill_ids": ["PRC_…", …] }                 ← 코드가 매핑한 값. 표지의 "사람" 선정에 쓴다
--
-- ⚠️ NULL 허용 — 과거 카드(~2026-10-15)는 전부 NULL 이고, 카드 뷰가 NULL 이면 구 표지로 렌더한다.
--    과거 카드를 소급 생성하지 않는다 ("카드는 한 번 쓰면 안 고친다").
ALTER TABLE briefing_posts ADD COLUMN IF NOT EXISTS hook JSONB;

COMMENT ON COLUMN briefing_posts.hook IS
  'SNS 카드 표지 훅 — {text(AI 질문 한 문장), theme, bill_count(코드 산출), bill_ids(코드 매핑)}. NULL 이면 구 표지';
