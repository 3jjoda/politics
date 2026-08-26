-- 2026-08-27 신고 처리 — 상태 컬럼 + target_id 폭 확장
--
-- 배경: `reports` 테이블은 만들어져 있었지만 **코드 참조가 0곳이고 행도 0건**이었다.
--   신고를 접수하는 UI 도, 처리하는 화면도 없었다. 즉 "있는 줄 알았는데 없는 기능" 이었다.
--   커뮤니티 「최근 대화」 피드(2026-08-27)로 댓글이 보이기 시작하면 곧바로 필요해진다.
--   선거법상 후보자 비방·허위사실 게시물 삭제 의무와도 직결된다 (ELECTION_LAW.md §5).
--
-- 🔴 **처리 단위는 「신고」가 아니라 「대상」이다.**
--   관리자가 판단하는 것은 "이 댓글을 지울까" 이지 "이 신고를 처리할까" 가 아니다.
--   같은 댓글에 신고가 3건 달렸으면 **한 번의 판단으로 3건이 같이 닫혀야** 한다.
--   → 화면은 대상 단위로 묶어 보여주고, 처리하면 그 대상의 open 신고를 한꺼번에 갱신한다.
--
-- status 3종:
--   open    미처리 (기본)
--   kept    살려둠 — 확인했고 문제 없다고 판단
--   removed 삭제함 — 대상의 is_deleted 를 TRUE 로 바꿨다
--   ⚠️ `kept` 를 "신고 기각" 같은 말로 바꾸지 말 것. 신고자를 심판하는 게 아니라 대상을 판단하는 것이다.
--
-- ⚠️ `target_id` 를 INTEGER → BIGINT 로 넓힌다.
--   `comments.id` · `posts.id` 가 BIGINT 라 타입이 어긋나 있었다. 지금은 값이 작아 안 터지지만
--   조용히 오버플로하는 종류의 버그다. (`likes.target_id` 도 같은 문제가 있으나 이번 범위 밖)

ALTER TABLE reports
  ALTER COLUMN target_id TYPE BIGINT,
  ADD COLUMN IF NOT EXISTS status     VARCHAR(20) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handled_by INT REFERENCES users(user_id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_status_check
    CHECK (status IN ('open', 'kept', 'removed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 처리 대기 큐 — 관리자 화면과 nav 배지가 이걸 읽는다. 부분 인덱스라 작다
CREATE INDEX IF NOT EXISTS idx_reports_open
  ON reports (created_at DESC) WHERE status = 'open';

-- 대상 단위 묶음 조회용
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports (type, target_id);

COMMENT ON COLUMN reports.status     IS 'open 미처리 | kept 살려둠 | removed 삭제함. 🔴 처리 단위는 신고가 아니라 대상이다 — 같은 대상의 open 은 한꺼번에 갱신된다';
COMMENT ON COLUMN reports.handled_by IS '처리한 관리자 user_id. 탈퇴 시 NULL (기록은 남기고 식별자만 지운다)';

-- ⚠️ CHECK 에 남아 있는 reason `political` 은 **화면 선택지에서 제외한다** (utils/reportReasons.js).
--   "정치적" 을 신고 사유로 열면 곧 진영 신고 도구가 되고, 중립을 표방하는 사이트가
--   그 이유로 글을 지우면 그 자체가 편집이 된다. 제약은 기존 데이터 호환을 위해 그대로 둔다.

-- 검증
-- SELECT status, COUNT(*) FROM reports GROUP BY 1;
-- SELECT type, target_id, COUNT(*) FROM reports WHERE status='open' GROUP BY 1,2 ORDER BY 3 DESC;
