-- 2026-08-11 AI 브리핑 피드
--
-- 배경:
--   `/briefing` 1단계는 주간 데이터 대시보드였다. 원래 구상은 그게 아니라
--   **"AI가 정리한 카드가 피드처럼 쌓이고, 댓글 달고 외부로 공유"** 였다.
--   피드가 되려면 생성물이 남아야 하므로 테이블이 필요하다 (Phase A 차트가 URL 만으로
--   공유되던 것과 다르다 — 브리핑은 매일 새 콘텐츠가 생기고 시간순으로 쌓인다).
--
-- 비용: 하루 1콜. 입력 ~2,000 tok(집계 + 대표 법안 5건) / 출력 ~400 tok
--       Haiku 기준 약 $0.004/일 = 연 $1.5. 법안별 분석($0.016/건)과 달리 하루치를 한 번에 넣는다.

CREATE TABLE IF NOT EXISTS briefing_posts (
  id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- 하루 1장. UNIQUE 라 재실행해도 중복이 안 생기고 UPSERT 로 덮어쓸 수 있다
  briefing_date  DATE         NOT NULL UNIQUE,
  headline       VARCHAR(140) NOT NULL,          -- 카드 제목 (한 줄)
  body           TEXT         NOT NULL,          -- 3~4문장
  keywords       JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- ["조세특례","세제",…] → 뉴스 검색 링크
  stats          JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- 그날 숫자 (발의·처리 등). AI 가 아니라 SQL 이 채운다
  bill_ids       JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- 카드에 붙일 대표 법안
  model          VARCHAR(50),
  prompt_version VARCHAR(10),
  tokens_input   INT,
  tokens_output  INT,
  cost_usd       NUMERIC(8,6),
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON COLUMN briefing_posts.stats IS
  '그날 집계 숫자. **AI 가 만든 값이 아니라 SQL 집계 결과**를 그대로 저장한다 — '
  '숫자를 AI 출력에서 받으면 환각 위험이 있고 검증도 불가능하다.';
COMMENT ON COLUMN briefing_posts.keywords IS
  'AI 가 뽑은 키워드. 뉴스 "검색 링크" 생성에만 쓴다 (기사 크롤링·수집 안 함 — 저작권·중립성).';

CREATE INDEX IF NOT EXISTS idx_briefing_posts_date ON briefing_posts (briefing_date DESC);

CREATE TRIGGER trg_briefing_posts_updated_at
    BEFORE UPDATE ON briefing_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 댓글·좋아요 재사용 — type 에 'briefing' 추가
--   기존 위젯(PB.mountComments / PB.mountLikes)이 type+target_id 로 동작하므로
--   CHECK 만 넓히면 코드 변경 없이 붙는다.
-- ---------------------------------------------------------------------------
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_type_check;
ALTER TABLE comments ADD CONSTRAINT comments_type_check
      CHECK (type IN ('politician', 'bill', 'post', 'briefing'));

ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_type_check;
ALTER TABLE likes ADD CONSTRAINT likes_type_check
      CHECK (type IN ('comment', 'post', 'briefing'));

-- 운영 확인:
--   SELECT briefing_date, headline, jsonb_array_length(keywords) AS kw, cost_usd
--     FROM briefing_posts ORDER BY briefing_date DESC LIMIT 10;
--   SELECT SUM(cost_usd) FROM briefing_posts;   -- 누적 비용
