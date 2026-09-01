-- 2026-09-01 「설명이 필요한 숫자」 카드 (`anomaly_cards`)
--
-- 존재 이유: 사이트에 지표는 많은데 **누가 이상한지를 사이트가 먼저 꺼내주지 않았다.**
--   `김태호 불참률 80.4%` · `우원식 대표발의 0건` · `박형수 법사위 103번 중 8번` 같은
--   "어? 왜?" 가 나오는 사실이 이미 데이터에 있는데, 보려면 의원 상세 309장을 하나씩 열거나
--   /xray 아코디언을 직접 펼쳐야 했다. 매일 한 장씩 꺼내 질문으로 만든다.
--
-- 🔴 **순위표가 아니다.** 목록으로 내면 그 자체가 정당 판정이 된다 —
--    실측 자당·타당 격차 15%p 이상 14명 중 **11명이 국민의힘**이다.
--    그래서 ① 하루 한 장 ② 지표를 돌아가며 ③ 순위·번호를 쓰지 않는다.
--    선정은 사람이 아니라 규칙이 하고, 그 규칙을 화면에 공개한다 (쟁점 `why` 노출과 같은 패턴).
--
-- 🔴 **값을 굳혀 저장하는 이유** — 결정적 생성만으로는 부족하다. 배치가 매일 돌아
--    불참률·좌표가 움직이므로, 같은 날짜를 나중에 다시 계산하면 **다른 사람이 뽑힐 수 있다.**
--    그러면 댓글이 엉뚱한 대상에 붙는다. 브리핑과 같은 판단 — **카드는 한 번 쓰면 고치지 않는다.**
--    그래서 화면에 필요한 값(수치·중앙값·설명·정당·지역구)을 전부 payload 에 굳힌다.

CREATE TABLE IF NOT EXISTS anomaly_cards (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_date   DATE        NOT NULL UNIQUE,        -- 하루 1장. 이 값이 곧 URL(`/why/2026-09-01`)이자 댓글 대상 키
  metric      VARCHAR(20) NOT NULL,               -- absent | gap | propose | committee | axis (utils/anomalies.js 가 단일 소스)
  mona_cd     VARCHAR(50) NOT NULL,               -- FK 안 건다 (politicians 는 현직만 담는다 — bill_votes 와 같은 판단)
  explained   BOOLEAN     NOT NULL DEFAULT FALSE, -- 관측 데이터로 이유를 댈 수 있었나
  payload     JSONB       NOT NULL,               -- 화면이 쓰는 값 전부. 생성 시점에 굳힌다
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_cards_date   ON anomaly_cards (card_date DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_cards_metric ON anomaly_cards (metric);
CREATE INDEX IF NOT EXISTS idx_anomaly_cards_mona   ON anomaly_cards (mona_cd);

COMMENT ON TABLE  anomaly_cards IS '「설명이 필요한 숫자」 — 하루 한 장. 값은 생성 시점에 굳힌다(브리핑과 같은 규칙).';
COMMENT ON COLUMN anomaly_cards.payload IS
  '{name, party, district, value, unit, headline, median, medianLabel, explainKind, explainText, caveats[], detail{}} — 화면이 DB 를 다시 조회하지 않아도 되게 전부 담는다.';

-- ─────────────────────────────────────────────────────────────
-- 댓글 대상에 `anomaly` 추가
-- ⚠️ DB CHECK 만 넓히면 안 된다. `services/CommentService.js` 의 VALID_TYPES 와
--    `services/LikeService.js` 의 VALID 도 같이 넓혀야 한다 — 한쪽만 하면 조용히 400 이 난다
--    (브리핑 추가 때 실제로 겪었다).
-- ⚠️ comments.target_id 는 VARCHAR 다. 여기엔 `card_date` 문자열('2026-09-01')이 들어간다.
--    likes.target_id 는 INTEGER 라 **카드 좋아요는 안 된다** (댓글 좋아요만 된다).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_type_check;
ALTER TABLE comments ADD  CONSTRAINT comments_type_check
  CHECK (type IN ('politician','bill','post','briefing','anomaly'));


-- ─────────────────────────────────────────────────────────────
-- 검증
-- ─────────────────────────────────────────────────────────────
-- 같은 사람이 자주 나오면 로테이션이 고장난 것이다 (배치가 최근 N일을 제외한다)
-- SELECT mona_cd, COUNT(*) n FROM anomaly_cards GROUP BY 1 HAVING COUNT(*)>1 ORDER BY n DESC;

-- 지표가 고르게 도는지 (한 지표에 몰리면 후보 고갈이다)
-- SELECT metric, COUNT(*) n, SUM(explained::int) 설명있음 FROM anomaly_cards GROUP BY 1 ORDER BY n DESC;

-- 정당이 한쪽으로 쏠리는지 — **안배하지 않지만 감시는 한다**
-- SELECT payload->>'party' party, COUNT(*) n FROM anomaly_cards GROUP BY 1 ORDER BY n DESC;
