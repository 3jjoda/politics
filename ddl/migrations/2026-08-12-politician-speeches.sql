-- 2026-08-12 의원 발언 기록 (`politician_speeches`)
--
-- ⚠️ **이 파일은 2026-08-15 에 라이브 스키마에서 복원한 것이다.** 원본 마이그레이션과 배치 코드가
--    유실됐는데 테이블과 데이터(66,651행)는 DB 에 남아 있어, DB 를 재생성하면 조용히 사라지는
--    상태였다. 아래 DDL 은 실제 스키마(information_schema + pg_indexes)와 일치한다.
--    ⛔ **적재 배치(`batch/syncSpeeches.js`)는 아직 없다** — ROADMAP 12번 참조.
--
-- 배경: "의원 평가 축이 부족하다" → 공공 API 전수 조사(278건) 결과 **출석 API 는 존재하지 않는다.**
--   본회의 출석률은 이미 `bill_votes` 의 불참으로 산출 가능하므로, 빈 곳은 **상임위**였다.
--   발언영상 API(`npeslxqbanwkimebr`)가 그 구멍을 메운다 — 회의의 **73%가 위원회·국감**이다.
--   (출석은 존재고 발언은 참여라, 출석보다 나은 지표이기도 하다)
--
-- 🔴 이 테이블을 집계할 때 반드시 지킬 것 (전부 실측으로 확인한 함정):
--   1. `role_kind='gov'` 를 의정활동에 넣지 말 것. 현역 의원이자 장관인 사람(정성호·김윤덕·윤호중)의
--      **장관 답변 시간**이 잡혀 상위 1~3위가 된다 — 성실도의 정반대를 재게 된다
--   2. `role_kind='chair'` 를 따로 볼 것. 위원장은 안건을 호명하느라 발언이 구조적으로 많다
--      (실측 서영교 위원장석 680건 vs 질의석 365건). 전체의 약 32%
--   3. `rec_sec` 은 **순수 발언시간이 아니다.** 한 클립에 질의와 답변이 함께 녹화돼 있다
--      ("김용민 위원 질의 / 정성호 장관 답변" 6:20). 비교에는 **클립 수**가 안전하다
--   4. 위원회마다 회의 빈도가 다르다 → 비교 시 `politician_committees` 소속으로 정규화할 것

CREATE TABLE IF NOT EXISTS politician_speeches (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clip_id      VARCHAR(20) NOT NULL,          -- 영상 클립 고유 id (LINK_URL 의 no=). 중복 제거 키
  mona_cd      VARCHAR(50) NOT NULL,
  role         VARCHAR(20),                   -- 원문 직위: 위원장 / 위원 / 간사 / 국회의장 / 장관 …
  role_kind    VARCHAR(10) NOT NULL,          -- chair | member | gov  (집계 시 반드시 구분)
  act          VARCHAR(20),                   -- 질의 / 발언 / 답변 / 인사 … (첫 번째 것만)
  taking_date  DATE        NOT NULL,
  meeting_kind VARCHAR(20),                   -- 본회의 | 위원회 | 소위원회 | 국정감사 | 국정조사 | 인사청문회 | 공청회 | 기타
  conf_title   TEXT,
  rec_sec      INT,                           -- 재생시간(초). ⚠️ 위 3번 참조
  link_url     TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (clip_id, mona_cd)
);

-- politicians 로의 FK 를 걸지 않는다 (politician_committees·bill_votes 와 같은 판단 —
-- 현직만 담는 테이블이라 승계·보선 타이밍에 INSERT 가 깨지면 안 된다)
CREATE INDEX IF NOT EXISTS idx_speeches_mona      ON politician_speeches (mona_cd);
CREATE INDEX IF NOT EXISTS idx_speeches_date      ON politician_speeches (taking_date);
CREATE INDEX IF NOT EXISTS idx_speeches_mona_kind ON politician_speeches (mona_cd, role_kind);

COMMENT ON TABLE politician_speeches IS
  '의원별 발언 기록. 클립 1개에 여러 사람이 등장하므로 (clip_id, mona_cd) 단위 행이다. '
  '⚠️ role_kind 를 구분하지 않고 집계하면 장관 답변·위원장 사회가 의정활동으로 둔갑한다.';
COMMENT ON COLUMN politician_speeches.rec_sec IS
  '클립 재생시간. 한 클립에 질의+답변이 함께 들어가므로 **개인 순수 발언시간이 아니다**. '
  '의원 간 비교에는 클립 수(COUNT)를 쓰는 편이 안전하다.';
COMMENT ON COLUMN politician_speeches.role_kind IS
  'chair=위원장석(사회) / member=질의석(의정활동) / gov=정부측. '
  '⚠️ 현재 gov 에 참고인·도지사·교수 등 비정부 외부인도 섞여 있다 (ROADMAP 12번 미해결 항목).';

-- 현재 적재 상태 (2026-08-15 실측): 66,651행 / 의원 309명 / 2024-06-05 ~ 2026-08-11
--   role_kind: member 40,208 · chair 21,535 · gov 4,908
--
-- 운영 확인:
--   SELECT role_kind, COUNT(*), COUNT(DISTINCT mona_cd) FROM politician_speeches GROUP BY 1;
--   SELECT meeting_kind, COUNT(*) FROM politician_speeches GROUP BY 1 ORDER BY 2 DESC;
