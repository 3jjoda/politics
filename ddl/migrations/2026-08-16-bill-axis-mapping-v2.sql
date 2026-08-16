-- 2026-08-16 — 법안-축 매핑 v2 (AI 1차 매핑 · 공동발의 기반 · 3축)
--
-- 배경 (CLAUDE.md 「매핑 확장 파일럿」):
--   v1(48건 · 본회의 표결)은 좌표가 뭉치고 출석률을 재고 있었다. 전 코퍼스 18,590건을 AI 로 분류해
--   (축×방향) 균형 선별한 4,972건 중 **안보 118건을 뺀 4,854건**을 v2 로 채택한다.
--   안보는 `자주` 방향 법안이 코퍼스 전체에 59건뿐이라 입법 기록으로 잴 수 없다 (분할-반 신뢰도 0.52).
--
-- 🔴 버전은 두 갈래다:
--   · 사용자 좌표(문항)   — balance_game_questions / user_axis_score 의 mapping_version = 'v1' **그대로**
--   · 의원 좌표(법안 매핑) — bill_axis_mapping / politician_axis_score 의 mapping_version = 'v2'
--   같은 문자열을 쓰던 걸 갈랐다. 사용자 쪽까지 올리면 기존 진단 결과가 통째로 안 보이게 된다.
--   코드의 단일 소스: utils/axisConfig.js (POL_MAPPING_VERSION · MATCH_AXES)
--
-- 실행 순서: 이 파일 → node batch/calcPoliticianAxis.js --version v2 → 서버 재시작

BEGIN;

-- 1) bill_axis_mapping: PK 가 bill_id 단독이라 버전이 겹칠 수 없었다 → (bill_id, mapping_version)
ALTER TABLE bill_axis_mapping DROP CONSTRAINT bill_axis_mapping_pkey;
ALTER TABLE bill_axis_mapping ADD PRIMARY KEY (bill_id, mapping_version);
CREATE INDEX IF NOT EXISTS idx_bam_version_axis ON bill_axis_mapping (mapping_version, axis);

-- 2) politician_axis_score: 못 재는 축은 NULL 로 둔다 (0 으로 채우면 "중도" 로 읽힌다) + 축별 서명 수
ALTER TABLE politician_axis_score
    ALTER COLUMN economy     DROP NOT NULL,
    ALTER COLUMN social      DROP NOT NULL,
    ALTER COLUMN security    DROP NOT NULL,
    ALTER COLUMN institution DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS economy_n     SMALLINT,
    ADD COLUMN IF NOT EXISTS social_n      SMALLINT,
    ADD COLUMN IF NOT EXISTS security_n    SMALLINT,
    ADD COLUMN IF NOT EXISTS institution_n SMALLINT;
COMMENT ON COLUMN politician_axis_score.security IS 'v2 부터 NULL — 안보축은 입법 기록(공동발의)으로 잴 수 없다. 0 으로 채우지 말 것';
COMMENT ON COLUMN politician_axis_score.vote_count_used IS 'v1: 찬성·반대 표결 수 / v2: 세 축 서명 법안 수 합계';

-- 3) v2 매핑 적재 — 파일럿 테이블의 균형 선별분, 안보 제외
INSERT INTO bill_axis_mapping (bill_id, axis, agree_score, disagree_score, weight, mapping_version, mapped_by, notes)
SELECT bill_id, axis, agree_score, disagree_score, weight, 'v2', 'ai_v2',
       confidence || ' · ' || COALESCE(reason, '')
  FROM bill_axis_mapping_pilot
 WHERE is_selected AND axis IN ('economy', 'social', 'institution')
ON CONFLICT (bill_id, mapping_version) DO NOTHING;

COMMIT;

-- 검증
-- SELECT mapping_version, axis, agree_score, COUNT(*) FROM bill_axis_mapping GROUP BY 1,2,3 ORDER BY 1,2,3;
--   기대: v2 economy ±1 각 1052 · social 각 981 · institution 각 394 = 4,854
