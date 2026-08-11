-- 2026-08-12 의원 특수 직위 (국회의장 / 부의장 / 장관 겸직) — **수동 관리 컬럼**
--
-- 왜 수동인가:
--   대상이 10명 남짓(의장 1 · 부의장 2 · 장관 7)이고 원구성·개각 때만 바뀐다.
--   자동 추출도 검토했으나(발언영상 API 의 ESSENTIAL_PERSON 에 "조정식 국회의장" 처럼 찍힌다)
--   비용 대비 정확도가 나빴다:
--     · 발언을 해야 잡힌다 — 실측에서 후반기 부의장 박덕흠(2건)·남인순(1건)이 임계값에 못 미쳐 누락
--     · MONA_CD 가 없어 이름 매칭이라 동명이인 위험
--     · 임기가 아니라 "최근 발언일" 이라 취임·퇴임 시점이 안 나온다
--     · 노이즈 — 원구성 때 임시의장 사회를 본 주호영이 '국회의장' 3건으로 잡혔다
--   자동화해도 결국 사람이 확인해 고쳐야 하므로, 처음부터 사람이 넣는 편이 정확하고 싸다.
--
-- ⚠️ 화면 최상단(이름 옆)에 나가는 값이다. **틀리면 바로 눈에 띄는 오류**이므로 정확도가 최우선.

ALTER TABLE politicians
  ADD COLUMN IF NOT EXISTS special_title            VARCHAR(60),
  ADD COLUMN IF NOT EXISTS special_title_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN politicians.special_title IS
  '국회의장 / 국회부의장 / "○○부 장관" 등 특수 직위. **수동 관리**. '
  '표기 규칙: 의장·부의장은 직위만("국회의장"), 장관은 부처를 붙인다("법무부 장관"). '
  '⚠️ syncPoliticians 의 ON CONFLICT DO UPDATE SET 은 컬럼을 명시 나열하므로 이 값을 덮지 않는다 '
  '— 단 그 SET 목록에 이 컬럼을 추가하면 매일 밤 지워진다. 절대 넣지 말 것.';
COMMENT ON COLUMN politicians.special_title_updated_at IS
  '수동 갱신 시각. 수동 컬럼은 조용히 낡는 것이 유일한 실패 모드라 마지막 손댄 때를 남긴다.';

CREATE INDEX IF NOT EXISTS idx_politicians_special_title
  ON politicians (special_title) WHERE special_title IS NOT NULL;

-- 값 갱신은 ddl/seeds/politician_special_title.sql 참조 (검증 후 실행)
--
-- 확인:
--   SELECT name, party_name, special_title,
--          TO_CHAR(special_title_updated_at,'YYYY-MM-DD') AS 갱신일
--     FROM politicians WHERE special_title IS NOT NULL ORDER BY special_title, name;
