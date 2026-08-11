-- 2026-08-12 위원회 위원 명단
--
-- 왜 필요한가:
--   지금까지 "이 의원이 어느 위원회에서 일하는가" 를 알 수 없었다.
--   `politicians.cmit_nm` / `cmits` 컬럼이 있긴 한데 **309명 전원 NULL** — 만들어만 두고
--   채운 적이 없다 (syncPoliticians 가 쓰는 현역의원 API 가 위원회를 안 준다).
--   `bills.committee` 는 "법안이 어느 위원회로 갔나" 지 "의원이 어디 소속인가" 가 아니다.
--
-- 이것이 왜 먼저인가 (발언·출석 지표보다):
--   위원회는 **분모**다. 상임위마다 회의 빈도가 달라서, 소속을 모르면 활동량을 비교할 수 없다.
--   "발언 30건" 이 많은지 적은지는 그 의원이 어느 위원회 소속인지를 알아야 판정된다.
--
-- 소스: 열린국회정보 `nktulghcadyhmiqxi` (위원회 위원 명단)
--   실측 477행 / 23개 위원회 / **MONA_CD 누락 0 · politicians 매칭 실패 0**
--   구성: 위원 417 · 간사 39 · 위원장 21
--   의원 298명 커버 (1~6개 위원회 중복 소속), 미소속 11명

CREATE TABLE IF NOT EXISTS politician_committees (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mona_cd     VARCHAR(50)  NOT NULL,
  dept_cd     VARCHAR(20)  NOT NULL,          -- 위원회 코드 (API DEPT_CD)
  dept_nm     VARCHAR(200) NOT NULL,          -- 위원회명. 특위는 이름이 길다(60자+)
  job_res_nm  VARCHAR(20),                    -- 위원장 | 간사 | 위원
  room_no     VARCHAR(20),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (mona_cd, dept_cd)
);

-- ⚠️ **politicians 로의 FK 를 걸지 않는다.**
--    politicians 는 현직만 담는데(CLAUDE.md 참조) syncPoliticians 가 늦게 돌거나 승계·보선으로
--    아직 없는 의원이 명단에 뜨면, FK 가 있으면 **트랜잭션 전체가 실패해 명단이 통째로 비워진다.**
--    bill_votes / bill_co_proposers 가 mona_cd 를 FK 없이 들고 있는 것과 같은 판단이다.
CREATE INDEX IF NOT EXISTS idx_politician_committees_mona ON politician_committees (mona_cd);
CREATE INDEX IF NOT EXISTS idx_politician_committees_dept ON politician_committees (dept_cd);

DROP TRIGGER IF EXISTS trg_politician_committees_updated_at ON politician_committees;
CREATE TRIGGER trg_politician_committees_updated_at
    BEFORE UPDATE ON politician_committees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE politician_committees IS
  '위원회 위원 명단 — **현재 시점 스냅샷**이다. API 가 대수·기간 인자를 주지 않아 이력이 아니다. '
  '배치가 매번 전체 교체(DELETE+INSERT)하므로 "과거에 어느 위원회였나" 는 답할 수 없다. '
  '이력이 필요해지면 별도 history 테이블을 만들 것 — 이 테이블을 이력용으로 개조하지 말 것.';
COMMENT ON COLUMN politician_committees.job_res_nm IS
  '위원장/간사/위원. ⚠️ 발언량·활동량 지표를 만들 때 **위원장은 반드시 분리**할 것 — '
  '위원장은 안건을 호명하느라 발언이 구조적으로 많다 (실측: 전체 발언시간의 14%가 위원장석).';

-- 운영 확인:
--   SELECT dept_nm, COUNT(*) FROM politician_committees GROUP BY 1 ORDER BY 2 DESC;
--   SELECT COUNT(DISTINCT mona_cd) FROM politician_committees;   -- 298 예상
