-- 2026-08-11 브리핑 v2 — 주제 묶음(threads)
--
-- 배경:
--   v1 카드는 AI 를 썼지만 결과물이 폴백(SQL 집계 재서술)과 거의 같았다.
--   원인은 프롬프트가 **폴백의 직무기술서를 그대로 AI 에게 시킨 것**이었다
--   ("3~4문장. 무엇이 몇 건 있었고 어디에 몰렸는지").
--   게다가 입력이 상위 5건 × 요약 160자뿐이라 나머지 법안은 AI 가 보지도 못했다.
--
--   실측 비교 (2026-07-30, 발의 51건):
--     v1 → "국토교통위 11건, 보건복지위 9건, 기후에너지위 8건에서 발의가 집중됐다"
--     v2 → "인구감소지역 지원 25건 — 지자체 의료·교육·주거 인프라에 국가가 우선 지원…"
--   51건 중 절반이 하나의 정책 패키지였는데 v1 은 이를 세 위원회로 흩어놨다.
--
--   ⚠️ 이건 SQL 이 더 못하는 게 아니라 **구조적으로 불가능한 일**이다.
--      집계 키가 committee 와 bill_name 인데, 이 묶음은 14개 부처·서로 다른 법률에
--      걸쳐 있어서 두 키 모두 묶음을 쪼갠다. 08-10 "청년 자산 형성" 도 소득세법·
--      조세특례제한법에 나뉘어 있어 bill_name 그룹핑에 안 걸린다.
--      → AI 가 실제로 값을 더하는 지점이 여기다. 요약만 시킬 거면 AI 를 뺄 일이었다.

ALTER TABLE briefing_posts
  ADD COLUMN IF NOT EXISTS threads JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN briefing_posts.threads IS
  '그날 법안들을 관통하는 주제 묶음. [{theme, what, bill_count, bill_ids[]}] '
  '⚠️ bill_count 는 **AI 가 센 값이 아니다** — AI 는 묶은 법안의 번호만 돌려주고 '
  '코드가 그 개수를 센다. 실험에서 AI 에게 직접 세게 했더니 21건으로 답했으나 실제는 '
  '25건이었다 (2026-07-30 인구감소지역). "숫자는 AI 에게서 받지 않는다" 원칙은 '
  'stats 뿐 아니라 여기에도 적용된다.';

-- 운영 확인:
--   SELECT briefing_date, jsonb_array_length(threads) AS n_threads,
--          jsonb_path_query_array(threads, '$[*].theme') AS themes
--     FROM briefing_posts ORDER BY briefing_date DESC LIMIT 10;
