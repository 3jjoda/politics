-- 2026-08-27 방문 통계 — 신규 / 재방문 분리
--
-- 왜:
--   운영 초기에 유일하게 의미 있는 지표가 **재방문**이다. 유입은 SNS 가 만들어주지만
--   재방문은 콘텐츠가 만든다. 그런데 잴 수단이 없었다 —
--   `_v` 쿠키는 1년짜리로 잘 발급되고 있었는데, 서버는 그걸 **그날 안에서 중복을 제거하는 용도로만**
--   썼다 (`state.seen` 은 프로세스 메모리 Set, 매일 리셋). "이 사람이 어제도 왔나" 를 알 방법이 없었다.
--
--   ⚠️ 그리고 이건 **소급이 안 된다.** 안 넣으면 오늘부터의 재방문을 영영 못 잰다.
--
-- 어떻게 — 개인을 식별하지 않고 잰다:
--   쿠키 값에 **최초 방문일**을 같이 담고(`<16hex>.<YYYYMMDD>`), 요청 때 그 날짜만 오늘과 비교해
--   `신규` / `재방문` 카운터 **둘 중 하나만** 올린다. DB 에는 일별 합계 두 컬럼만 늘어난다.
--   방문자별 기록은 여전히 0 이다 (2026-08-16 마이그레이션의 개인정보 원칙 그대로).
--
-- 🔴 PK 를 바꾸지 않았다 — member_views 를 더했을 때와 같은 판단.
--   컬럼을 더하면 기존 행·기존 쿼리가 안 깨진다.
--
-- 🔴 두 컬럼은 **`page_kind = 'site'` 행에만** 값이 들어간다.
--   "이 사람이 사이트에 다시 왔나" 가 질문이지 "이 법안 페이지에 다시 왔나" 가 아니다.
--   페이지별로 세면 한 방문자가 페이지 수만큼 중복 계상되어 합계가 방문자 수를 넘는다.
--
-- ⚠️ 도입 이전부터 `_v` 를 갖고 있던 방문자(구 형식 = 날짜 없음)는 **재방문으로 센다** —
--   쿠키가 있다는 것 자체가 전에 왔다는 뜻이다. 다만 최초 방문일을 모르므로 그 시점에 오늘 날짜로
--   다시 발급한다. 즉 **도입 직후 며칠은 재방문이 과소 계상**될 수 있다 (그 사람들이 내일부터 정상 판정).
--
-- 🔴 `page_kind='site'` 행에서 **신규 + 재방문 = uniques** 다 (실측 확인 2026-08-27: 4 = 2 + 2).
--   둘 다 "그날 사이트를 본 서로 다른 방문자" 를 한 번씩 세므로 같은 집합을 쪼갠 것이다.
--   → 어긋나면 집계 버그다. 점검 신호로 쓸 것.
--   ⚠️ 회원/비회원 분해(member_*)와는 **축이 다르다** — 신규·재방문은 회원 여부를 나누지 않는다
--      (쿠키는 사람을 모른다). 두 분해를 교차해서 더하지 말 것.

ALTER TABLE page_views_daily
  ADD COLUMN IF NOT EXISTS new_visitors       INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returning_visitors INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN page_views_daily.new_visitors       IS '그날 처음 방문한 사람 수 (page_kind=''site'' 행에만). 쿠키의 최초 방문일 = 오늘';
COMMENT ON COLUMN page_views_daily.returning_visitors IS '그날 다시 방문한 사람 수 (page_kind=''site'' 행에만). 2026-08-27 이전 행은 0(미측정)';

-- 검증
-- SELECT view_date, new_visitors, returning_visitors,
--        ROUND(returning_visitors * 100.0 / NULLIF(new_visitors + returning_visitors, 0)) AS ret_pct
--   FROM page_views_daily WHERE page_kind = 'site' ORDER BY view_date DESC LIMIT 14;
