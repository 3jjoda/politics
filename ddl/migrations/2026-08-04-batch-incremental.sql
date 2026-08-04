-- 2026-08-04 배치 증분화 (크론 등록 대비)
--
-- 1) syncVotes 전건 재스캔 제거
--    기존: proc_result_name IS NOT NULL 인 법안 4,541건을 매 실행마다 API 호출
--          → 실제 표결이 있는 건 598건뿐. 호출의 87%가 빈 응답.
--    변경: 마지막 스캔 이후 법안 상태가 바뀐 건 + 미스캔 건만 조회
--
-- 2) bills 전건 UPDATE 제거
--    기존: 18,558행을 매일 무조건 UPDATE → dead tuple 18k/일
--    변경: 실제 값이 바뀐 행만 UPDATE (IS DISTINCT FROM 가드, syncBills.js)
--    부작용: bills.updated_at 이 더 이상 "배치 실행 시각"이 아니게 됨
--          → nav 갱신 배지 소스를 batch_runs 로 이관

-- ---------------------------------------------------------------------------
-- bills.vote_synced_at — syncVotes 가 이 법안을 마지막으로 스캔한 시각
-- ---------------------------------------------------------------------------
ALTER TABLE bills ADD COLUMN IF NOT EXISTS vote_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN bills.vote_synced_at IS
  'syncVotes.js 가 이 법안의 표결을 마지막으로 조회한 시각. NULL = 미스캔. '
  'updated_at > vote_synced_at 이면 스캔 이후 법안 상태가 바뀐 것이므로 재조회 대상.';

-- 증분 대상 조회 전용 부분 인덱스 (처리완료 법안만 스캔 대상)
CREATE INDEX IF NOT EXISTS idx_bills_vote_sync
    ON bills (vote_synced_at, updated_at)
    WHERE proc_result_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- batch_runs — 배치 실행 기록
--   · nav "법안 N시간 전 갱신" 배지 소스 (bills.updated_at 대체)
--   · 크론 실패 추적 (배치가 exit 0 으로 끝나 cron 이 실패를 못 잡는 문제 보완)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batch_runs (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_name  VARCHAR(50)  NOT NULL,          -- 'syncPoliticians' | 'syncBills' | 'syncVotes'
  status      VARCHAR(20)  NOT NULL DEFAULT 'running'
              CHECK (status IN ('running','success','failed')),
  started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INT,
  stats       JSONB,                          -- 배치별 처리 건수 등
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_runs_name_finished
    ON batch_runs (batch_name, finished_at DESC);

-- ---------------------------------------------------------------------------
-- 참고: 마이그레이션 직후 첫 syncVotes 실행은 vote_synced_at 이 전부 NULL 이라
--       기존과 동일하게 전건(4,541) 스캔합니다. 이때 baseline 이 잡히고,
--       그 다음 실행부터 신규/변경분만 조회합니다. 별도 백필 불필요.
--
-- 운영 확인 쿼리:
--   SELECT batch_name, status, started_at, duration_ms, stats
--     FROM batch_runs ORDER BY started_at DESC LIMIT 20;
--
--   SELECT count(*) FILTER (WHERE vote_synced_at IS NULL) AS 미스캔,
--          count(*) FILTER (WHERE updated_at > vote_synced_at) AS 재스캔대상,
--          count(*) AS 전체
--     FROM bills WHERE proc_result_name IS NOT NULL;
