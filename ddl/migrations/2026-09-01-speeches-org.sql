-- 2026-09-01 발언 기록에 소속(org) 저장 + 직위 컬럼 확장
--
-- 배경: `politician_speeches.role_kind='chair'` 에 **정부·독립기관 위원장이 섞여 있었다.**
--   원천(`ESSENTIAL_PERSON`)은 `"이름 직위(소속)  행위"` 인데, 배치가 소속을 파싱만 하고
--   **저장도 분류도 하지 않았다.** 그래서 직위 문자열만 보고
--     "이진숙 위원장(방송통신위원회)  답변"  →  국회 상임위원장 사회 발언
--   으로 집계했다. 이진숙 192건 · 김태규 227건이 그렇게 잡혔고, 두 사람 모두 나중에
--   국회의원이 되어 이름 매칭에 걸렸다. chair 는 집계 대상이라
--   **상임위 발언 참여율(`politician_committee_speech`)의 분자·분모까지 오염**됐다.
--
--   더해서 파서가 직위를 한 어절로만 봐서, 직위가 두 어절이면 소속을 통째로 놓쳤다:
--     "김태규 위원장 직무대행(방송통신위원회)  답변"
--       → 구: 직위=위원장 · 소속=없음 · 행위=직무대행   (소속도 진짜 행위도 잃는다)
--   실측 544건. 그래서 소속 기반 판정이 성립하려면 파서를 먼저 고쳐야 했다.
--
-- 이 파일은 **컬럼만** 만든다. 값을 채우는 건 배치다:
--     node batch/syncSpeeches.js --full     (전건 재파싱 · UPSERT)
--     node batch/refreshCommitteeSpeech.js  (참여율 MV 재계산)
--
-- ⚠️ 순서를 지킬 것. 이 파일 → syncSpeeches --full → refreshCommitteeSpeech.
--    중간에 멈추면 org 가 NULL 인 옛 행이 남고, 아래 검증 쿼리가 그걸 잡는다.

ALTER TABLE politician_speeches
  ADD COLUMN IF NOT EXISTS org VARCHAR(60);        -- 괄호 안 소속: 정당명 또는 기관명. NULL = 원문에 괄호 없음

COMMENT ON COLUMN politician_speeches.org IS
  '원문 괄호 안 소속. 정당명이면 국회의원, 기관명이면 정부·외부인. NULL 은 소속 표기 없음(국회의장은 당적 이탈이라 정상).';

-- 직위가 여러 어절로 저장된다 (`위원장 직무대행`). 구 VARCHAR(20) 으로는 잘린다.
ALTER TABLE politician_speeches
  ALTER COLUMN role TYPE VARCHAR(40);

-- 소속으로 훑는 진단 쿼리를 위한 부분 인덱스 (NULL 이 다수라 부분으로 충분)
CREATE INDEX IF NOT EXISTS idx_speeches_org ON politician_speeches (org) WHERE org IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 검증 (배치 두 개를 돌린 뒤 실행할 것)
-- ─────────────────────────────────────────────────────────────

-- 1) 집계 대상(chair·member)에 **기관 소속**이 남아 있으면 안 된다 → 기관명이 뜨면 버그다
--    ⚠️ 정당명이 뜨는 건 정상이다. `parties` 는 현재 정당만 담아서 임기 중 사라진 정당
--       (실측: 새로운미래 10 · 국민의미래 1)이 빠져 있고, 배치는 PARTY_FALLBACK 으로 그걸 살린다.
--       즉 이 쿼리는 배치의 폴백 목록을 모른다 — **뜬 이름이 정당인지 기관인지 눈으로 볼 것.**
-- SELECT org, role_kind, COUNT(*) n
--   FROM politician_speeches
--  WHERE role_kind IN ('chair','member') AND org IS NOT NULL
--    AND org NOT IN (SELECT party_name FROM parties)
--  GROUP BY 1,2 ORDER BY n DESC;

-- 2) 위원장 사회 발언에 정부측 행위가 섞이면 안 된다 → **0행이어야 정상**
--    (수정 전 419건: 이진숙 172 · 김태규 227 · 최민희 3 …)
-- SELECT p.name, s.role, s.org, s.act, COUNT(*) n
--   FROM politician_speeches s JOIN politicians p ON p.mona_cd = s.mona_cd
--  WHERE s.role_kind = 'chair' AND s.act IN ('답변','직무대행')
--  GROUP BY 1,2,3,4 ORDER BY n DESC;

-- 3) --full 을 안 돌렸으면 옛 행에 org 가 없다 (괄호 없는 정상 케이스와 섞이므로 role 로 본다)
-- SELECT COUNT(*) FROM politician_speeches WHERE org IS NULL AND role_kind IN ('chair','member');
