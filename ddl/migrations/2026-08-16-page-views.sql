-- 2026-08-16 방문 통계 (`page_views_daily` · `user_visit_days`) — 관리자 전용
--
-- 왜 필요한가:
--   "사이트가 얼마나 쓰이나 / 어느 페이지가 보이나" 를 운영자가 알 방법이 없었다.
--   Cloudflare 대시보드는 요청 수·국가는 주지만 **어느 법안·의원 페이지가 보였는지**는 못 준다.
--   구 `utils/visitorCounter.js` 는 JSON 파일 저장이라 Railway 휘발 파일시스템에서 재배포마다 0 이 됐다.
--
-- 🔴 공개 카운터가 아니다. 관리자(`/admin/stats`)만 본다.
--   초기엔 작은 숫자가 신뢰도를 깎고, 조회 순위를 공개하면 그 자체가 편집이 된다.
--
-- 🔴 개인정보를 남기지 않는다:
--   - IP · UA · 리퍼러 · 방문자 식별자(쿠키 값)는 **저장하지 않는다.** 일별 합계만 남는다.
--   - 유니크 방문자 판정은 프로세스 메모리에서만 하고 DB 에는 숫자만 온다.
--   - `user_visit_days` 는 로그인 사용자의 **날짜 단위 접속 여부**뿐이다. 어느 페이지를 봤는지는 없다 —
--     정치 사이트에서 "누가 어느 의원 페이지를 봤나" 는 민감한 열람 기록이라 만들지 않는다.
--
-- ⚠️ 유니크는 근사값이다. 미들웨어가 하루 단위로 메모리에 본 식별자를 들고 있어
--   프로세스가 재시작되면 그날 방문자가 다시 세어질 수 있다. Cloudflare 의 Unique Visitors 와 같이 볼 것.
--
-- 쓰는 곳: middlewares/pageViews.js (UPSERT) · daos/queries/admin/getStats*.sql (읽기)

CREATE TABLE IF NOT EXISTS page_views_daily (
  view_date   DATE         NOT NULL,           -- KST 달력 날짜 (미들웨어가 Asia/Seoul 로 계산해 넘긴다)
  page_kind   VARCHAR(30)  NOT NULL,           -- 'site'(전체) | 'home' | 'bill' | 'bill_detail' | 'politician' | … (미들웨어 PAGE_KINDS)
  target_id   VARCHAR(50)  NOT NULL DEFAULT '',-- 상세 페이지의 대상 (bill_id · mona_cd · briefing id). 목록·홈은 ''
  views       INT          NOT NULL DEFAULT 0, -- 페이지뷰
  uniques     INT          NOT NULL DEFAULT 0, -- 그날 그 페이지를 본 방문자 수 (근사)
  PRIMARY KEY (view_date, page_kind, target_id)
);

-- 관리자 화면 "상세 TOP N" 용
CREATE INDEX IF NOT EXISTS idx_page_views_daily_kind_date ON page_views_daily (page_kind, view_date DESC);

COMMENT ON TABLE  page_views_daily IS '일별 페이지뷰·유니크 집계 (관리자 전용, 개인정보 없음). 미들웨어가 60초 버퍼 후 UPSERT';
COMMENT ON COLUMN page_views_daily.uniques IS '근사값 — 프로세스 메모리 기준 하루 유니크. 재시작 시 중복 가능';


-- 로그인 사용자의 접속일 (날짜 단위 · 페이지 정보 없음). 활성 사용자·재방문 파악용
CREATE TABLE IF NOT EXISTS user_visit_days (
  user_id     INT   NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,  -- 탈퇴(익명화)는 행을 남기지만 식별자가 사라진다
  visit_date  DATE  NOT NULL,
  views       INT   NOT NULL DEFAULT 0,        -- 그날 본 페이지 수 (어느 페이지인지는 없다)
  PRIMARY KEY (user_id, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_user_visit_days_date ON user_visit_days (visit_date DESC);

COMMENT ON TABLE user_visit_days IS '로그인 사용자 접속일 (날짜 단위만). 열람 페이지는 기록하지 않는다 — 개인정보처리방침 1항 "접속 로그" 범위';

-- 검증
-- SELECT * FROM page_views_daily WHERE view_date = CURRENT_DATE ORDER BY views DESC LIMIT 20;
-- SELECT visit_date, COUNT(*) AS users FROM user_visit_days GROUP BY 1 ORDER BY 1 DESC LIMIT 14;
