-- 2026-08-12 의원 직위 테이블 — politicians.special_title 컬럼을 대체
--
-- 왜 컬럼에서 테이블로:
--   한 사람이 **여러 직위를 동시에** 갖는다. 정책위의장이 당헌상 최고위원을 겸하는 정당이 있고,
--   관례상 여당 원내대표가 국회운영위원장을 맡는다. 문자열 컬럼 하나로는 못 담는다.
--   카테고리별로 표시 순서·스타일을 나눠야 하는 것도 컬럼으로는 안 된다.
--
-- 🔴 **전부 수동 입력이다.** 자동 수집 경로가 없다 — 소관 기관이 흩어져 있기 때문:
--     상임위원장·간사·위원 → 국회 (이미 politician_committees 로 확보, **여기 넣지 말 것**)
--     의장·부의장          → 국회. `역대 국회의장단` API 는 연혁용이라 현직이 늦게 반영된다
--     원내대표             → 정당 의원총회
--     당대표·최고위원 등   → 정당 전당대회 (정당법 소관, 국회사무처 소관 아님)
--     국무총리·장관        → 대통령 임명 (행정부)
--   국회 Open API 는 국회사무처 보유 정보를 공개하는 창구라, 뒤의 셋은 애초에 줄 수 있는 위치가 아니다.

CREATE TABLE IF NOT EXISTS politician_titles (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mona_cd    VARCHAR(50) NOT NULL,
  category   VARCHAR(20) NOT NULL,
  title      VARCHAR(60) NOT NULL,      -- '국회의장' / '원내대표' / '최고위원' / '법무부 장관'
  -- 🔴 수동 데이터의 생명은 출처다. 없으면 6개월 뒤 "이거 맞나" 를 처음부터 다시 찾게 된다.
  source_url TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mona_cd, title),
  CONSTRAINT politician_titles_category_check
    CHECK (category IN ('의장단', '국무위원', '교섭단체', '당직'))
);

-- politicians 로의 FK 를 걸지 않는다 (politician_committees 와 같은 판단 — 현직만 담는 테이블이라
-- 승계·보선 타이밍에 따라 없을 수 있고, 그때 INSERT 가 깨지면 안 된다)
CREATE INDEX IF NOT EXISTS idx_politician_titles_mona ON politician_titles (mona_cd);

DROP TRIGGER IF EXISTS trg_politician_titles_updated_at ON politician_titles;
CREATE TRIGGER trg_politician_titles_updated_at
    BEFORE UPDATE ON politician_titles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE politician_titles IS
  '의원의 특수 직위 — **전부 수동 관리**. 상임위 직위(위원장·간사·위원)는 여기가 아니라 '
  'politician_committees 가 담당한다 (그건 API 로 자동 수집된다). 중복 입력하지 말 것.';
COMMENT ON COLUMN politician_titles.category IS
  '의장단 | 국무위원 | 교섭단체 | 당직. 화면 표시 순서가 이 순서다 (공적 지위 → 정당 지위).';
COMMENT ON COLUMN politician_titles.updated_at IS
  '수동 데이터는 **조용히 낡는 것이 유일한 실패 모드**다. 오래된 행을 찾는 데 쓴다: '
  'SELECT * FROM politician_titles WHERE updated_at < NOW() - INTERVAL ''6 months'';';

-- 쓰지 않게 된 컬럼 정리 (2026-08-12 같은 날 추가했고 값이 들어간 적 없음)
ALTER TABLE politicians DROP COLUMN IF EXISTS special_title;
ALTER TABLE politicians DROP COLUMN IF EXISTS special_title_updated_at;
DROP INDEX IF EXISTS idx_politicians_special_title;

-- 확인:
--   SELECT p.name, t.category, t.title, TO_CHAR(t.updated_at,'YYYY-MM-DD') AS 갱신
--     FROM politician_titles t JOIN politicians p ON p.mona_cd = t.mona_cd
--    ORDER BY t.category, p.name;
