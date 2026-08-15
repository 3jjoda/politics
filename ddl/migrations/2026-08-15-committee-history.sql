-- 2026-08-15 위원회 소속 이력 (`politician_committee_history`)
--
-- 왜 필요한가:
--   `politician_committees` 는 **현재 스냅샷**이다 (원천 API 에 대수·기간 인자가 없다).
--   그래서 "언제 이 위원회에 배정됐나" 를 답할 수 없고, 참여율의 **분모를 정할 수 없었다.**
--   지금은 소속 시작을 "그 위원회에서의 첫 발언일" 로 근사하는데, 그러면
--   **배정 후 조용히 앉아 있던 기간이 분모에서 통째로 빠져 값이 실제보다 후하다.**
--
-- 🔴 이건 **관측 이력이지 공식 배정 기록이 아니다.**
--   배치가 매일 명단을 보고 "어제는 없었는데 오늘 있다" 를 기록하는 것뿐이다.
--   그래서 `started_on` 은 **배정일이 아니라 관측일**이다 (최대 하루 오차 + 배치가 멈춘 기간만큼).
--   화면에 "배정일" 이라고 쓰지 말 것.
--
-- 🔴 **최초 적재분(시드)은 `started_on` 을 알 수 없다.**
--   오늘 시점의 명단 477행은 2024년부터 있던 사람과 지난주 배정된 사람이 섞여 있는데
--   구분할 방법이 없다. 여기에 오늘 날짜를 찍으면 **모두가 "오늘 배정됨" 이 되어
--   분모가 0에 수렴하고 참여율이 통째로 망가진다.**
--   → 시드는 `started_on = NULL`, `is_seed = TRUE`. 소비하는 쪽이 이걸 보고 근사로 폴백한다.
--
-- 타이밍: 22대 **후반기 원구성 직후**에 시작한다 (현 소속 위원회 첫 발언이 2026-07 에 137명,
--   08 에 48명 — 전체 477쌍의 39%가 최근 두 달). 이번 임기 내내 정확한 분모를 갖게 된다.

CREATE TABLE IF NOT EXISTS politician_committee_history (
  id           BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mona_cd      VARCHAR(50)  NOT NULL,
  dept_cd      VARCHAR(20),
  dept_nm      VARCHAR(200) NOT NULL,
  job_res_nm   VARCHAR(50),               -- 마지막으로 확인한 직위 (아래 ⚠️ 참조)

  started_on   DATE,                      -- 명단에 **나타난** 날. NULL = 시드분(언제부터인지 모름)
  ended_on     DATE,                      -- 명단에서 **사라진** 날. NULL = 현재 소속
  last_seen    DATE         NOT NULL,     -- 명단에서 마지막으로 확인한 날

  is_seed      BOOLEAN      NOT NULL DEFAULT FALSE,  -- 최초 적재분 → started_on 을 신뢰하지 말 것
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- 한 사람이 같은 위원회에 두 번 들어올 수 있으므로(사임 후 복귀) 전체 UNIQUE 는 걸 수 없다.
-- 대신 **열려 있는 구간은 쌍당 하나**여야 한다 — 이게 없으면 배치 중복 실행이 구간을 복제한다.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pch_open
  ON politician_committee_history (mona_cd, dept_nm)
  WHERE ended_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_pch_mona ON politician_committee_history (mona_cd);
CREATE INDEX IF NOT EXISTS idx_pch_open_start
  ON politician_committee_history (mona_cd, dept_nm, started_on)
  WHERE ended_on IS NULL AND NOT is_seed;

-- politicians 로의 FK 를 걸지 않는다 (politician_committees·bill_votes 와 같은 판단 —
-- politicians 는 현직만 담아서 승계·보선 타이밍에 INSERT 가 깨지면 이력이 통째로 안 쌓인다)

DROP TRIGGER IF EXISTS trg_pch_updated_at ON politician_committee_history;
CREATE TRIGGER trg_pch_updated_at
  BEFORE UPDATE ON politician_committee_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE politician_committee_history IS
  '위원회 소속 관측 이력. syncCommittees 가 매일 스냅샷을 비교해 변경분만 기록한다. '
  '⚠️ 공식 배정 기록이 아니라 관측 기록이다 — started_on 은 "명단에서 처음 본 날" 이다. '
  '⚠️ is_seed=TRUE 인 행은 started_on 이 NULL 이다 (최초 적재분은 시작 시점을 알 수 없다).';
COMMENT ON COLUMN politician_committee_history.started_on IS
  '명단에 나타난 날(관측). NULL = 시드분. 화면에 "배정일" 로 쓰지 말 것.';
COMMENT ON COLUMN politician_committee_history.ended_on IS
  '명단에서 사라진 날. **오늘이 아니라 last_seen 을 찍는다** — 배치가 며칠 멈췄을 때 '
  '"어제까지 있었다" 고 단정하면 안 되기 때문이다.';
COMMENT ON COLUMN politician_committee_history.job_res_nm IS
  '⚠️ 마지막으로 확인한 직위. 위원→간사 승격은 구간을 끊지 않고 이 값만 갱신한다 '
  '(구간이 쪼개지면 참여율 분모가 조각난다). 그래서 "언제 간사가 됐나" 는 답할 수 없다.';

-- ── 시드: 현재 명단을 열린 구간으로 적재 (started_on 은 NULL — 위 🔴 참조) ──
INSERT INTO politician_committee_history
       (mona_cd, dept_cd, dept_nm, job_res_nm, started_on, ended_on, last_seen, is_seed)
SELECT pc.mona_cd, pc.dept_cd, pc.dept_nm, pc.job_res_nm,
       NULL, NULL, (NOW() AT TIME ZONE 'Asia/Seoul')::date, TRUE
  FROM politician_committees pc
 WHERE NOT EXISTS (
       SELECT 1 FROM politician_committee_history h
        WHERE h.mona_cd = pc.mona_cd AND h.dept_nm = pc.dept_nm AND h.ended_on IS NULL);

-- 검증:
--   SELECT is_seed, COUNT(*), COUNT(started_on) FROM politician_committee_history
--    WHERE ended_on IS NULL GROUP BY 1;          -- 시드분은 started_on 이 0이어야 정상
--   SELECT COUNT(*) FROM politician_committees;  -- 위 열린 구간 수와 같아야 한다
