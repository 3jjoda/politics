-- 2026-08-18 방문 통계 — 회원/비회원 분리 + 관리자 제외
--
-- 왜:
--   운영 초기엔 **관리자 본인 브라우징이 통계를 지배한다.** 실측(2026-08-16~18):
--     08-16 전체 192뷰 중 회원 154뷰(80%) — 그중 관리자 1명이 131뷰
--     08-18 전체 101뷰 중 회원  80뷰(79%)
--   "정말 외부 사람이 얼마나 왔나" 를 볼 수가 없었다.
--
-- 어떻게:
--   ① 회원 뷰를 **별도 컬럼**으로 같이 센다 → 비회원 = views - member_views
--   ② 관리자(ADMIN_EMAILS)는 아예 집계하지 않는다 (middlewares/pageViews.js)
--
-- 🔴 PK 를 바꾸지 않았다 (view_date, page_kind, target_id 그대로).
--   `is_member` 를 PK 에 넣어 행을 쪼개는 안도 있었지만, 그러면 **기존 55행의 의미가 갈리고**
--   읽기 쿼리 5종을 전부 고쳐야 한다. 컬럼을 더하면 `views` 의 뜻("전체")이 그대로 유지돼
--   과거 데이터와 기존 쿼리가 안 깨진다.
--
-- ⚠️ 마이그레이션 시점의 기존 행은 member_views = 0 이었다 (그때는 구분해서 세지 않았다).
--   → 2026-08-18 에 **page_views_daily · user_visit_days 를 전부 비우고 처음부터 다시 시작**했다.
--     관리자 브라우징이 전체의 80%를 차지해 어차피 쓸 수 없는 값이었고, 지우니 "구분 이전 구간" 자체가 사라졌다.
--   ⚠️ 다시 비울 일이 생기면 두 테이블을 **같이** 비울 것 — 한쪽만 지우면 화면의 회원/비회원 합이 안 맞는다.
--
-- ⚠️ 개인정보 원칙은 그대로다 — 여전히 **일별 합계만** 남는다.
--   회원 여부는 사람이 아니라 **집계 축**이고, 누가 무엇을 봤는지는 저장하지 않는다.
--   (user_visit_days 는 날짜 단위 접속 여부뿐 — 2026-08-16 마이그레이션 주석 참조)

ALTER TABLE page_views_daily
  ADD COLUMN IF NOT EXISTS member_views   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS member_uniques INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN page_views_daily.member_views   IS '전체(views) 중 로그인 회원의 페이지뷰. 비회원 = views - member_views. 2026-08-18 이전 행은 0(미구분)';
COMMENT ON COLUMN page_views_daily.member_uniques IS '전체(uniques) 중 로그인 상태로 본 방문자 수(근사). ⚠️ 같은 사람이 하루에 로그아웃·로그인 상태로 모두 보면 양쪽에 1씩 잡힌다';

-- 검증
-- SELECT view_date, views, member_views, views - member_views AS guest_views
--   FROM page_views_daily WHERE page_kind='site' ORDER BY view_date DESC LIMIT 7;
