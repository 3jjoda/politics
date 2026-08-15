-- 2026-08-15 위원회 발언 참여율 MV (`politician_committee_speech`)
--
-- 질문: "이 의원은 소속 위원회 회의에 얼마나 참여했나" — **소속기간으로 정규화**한 값.
--   건수(164건)만으로는 비교가 안 된다. 분모가 없기 때문이다.
--
-- 🔴 왜 이 형태여야 하는지 — 실측으로 걸러낸 대안들:
--   ① **전체 기간 참여율**: `politician_committees` 가 현재 스냅샷이라 언제 배정됐는지 모른다.
--      2024년 회의가 전부 분모에 들어가 **위원장 중앙값이 5.4%** 로 나왔다 (불가능한 값).
--   ② **최근 6개월 창**: 완화될 뿐 안 풀린다. 김민전은 2026-07-27에 법사위에 왔는데
--      6개월치 분모 19개를 뒤집어쓰고 11% 로 꼴찌였다 — 2년째 간사인 박형수(11%)와 같은 숫자.
--   ③ **발언한 날 전체 순위**: 상위 30명 중 10명이 법사위(회의 103개, 최다)였고
--      하위 14명 중 10명이 2026-06-05 입성자(재임 2개월)였다. 배정과 입성 시점을 재는 셈.
--   ④ 재임 개월로 나눠도 이번엔 **장관·총리 겸직자가 바닥**에 깔렸다 (김민석 0.5 · 정성호 0.8).
--
-- 그래서 **소속 시작을 "그 위원회에서의 첫 발언일" 로 근사**하고 그 이후 회의만 분모로 삼는다.
-- 실측상 이 근사는 분모만 충분하면 소속기간과 무관하게 수렴한다:
--     소속 6~12개월 중앙 53.4%  /  1~1.6년 45.0%  /  1.6년+ 53.6%
-- 반면 2개월 미만 구간은 **중앙값 100%** 로 깨진다 — 평균 분모가 2.4개뿐이라
-- "첫 회의는 정의상 발언한 회의" 가 되어 1/1 이 보장되기 때문이다.
--
-- 🔴 그래서 `MIN_DENOM = 11` 가드가 이 MV 의 핵심이다. 빼면 최근 배정자가 전부 100% 로 올라온다.
--
-- ⚠️ **남는 한계 (지워지지 않는다)**: 첫 발언 전 침묵기가 분모에서 사라진다.
--    6월에 배정됐는데 8월에 처음 발언했다면 6~7월 회의는 안 세어진다.
--    즉 이 값은 실제 참여율보다 **후하다**. 방향이 관대한 쪽이라 사람을 억울하게 만들진 않지만
--    정확한 값은 아니다. 근본 해법은 위원회 소속 이력 테이블이다 (ROADMAP 12번).
--
-- ⚠️ 회의 판정은 `conf_title LIKE '%위원회명%'` 이라 **국정감사·본회의·인사청문회는 분모에서 빠진다**
--    (제목이 `2024년도 국정감사(기획재정부 등)` 라 위원회명이 없다 — 253개 회의 0개 매칭).
--    그래서 이건 "상임위 회의 참여율" 이지 "의정활동 전체" 가 아니다. 화면에 그렇게 쓸 것.

DROP MATERIALIZED VIEW IF EXISTS politician_committee_speech;

CREATE MATERIALIZED VIEW politician_committee_speech AS
WITH mt AS (
    -- 회의 목록 (클립이 아니라 회의). role_kind 무관 — 누구든 발언했으면 그 회의는 열린 것이다
    SELECT DISTINCT taking_date, conf_title FROM politician_speeches
),
/* 위원회 × 회의를 **미리 한 번만** 매칭한다.
   ⚠️ 이걸 상관 서브쿼리로 두면 (388쌍 × 회의 1,422개) LIKE 가 55만 번 돌아 MV 생성이 16초 걸린다.
      여기서 한 번 펼쳐두면 아래는 등치 비교라 1초대로 떨어진다. */
cmt_mt AS (
    SELECT d.dept_nm, mt.taking_date, mt.conf_title
      FROM (SELECT DISTINCT dept_nm FROM politician_committees) d
      JOIN mt ON mt.conf_title LIKE '%' || d.dept_nm || '%'
),
/* ⚠️ 여기서도 LIKE 를 쓰면 안 된다. `politician_committees`(477) × `politician_speeches`(66,882) 를
      LIKE 로 붙이면 3,200만 번 평가돼 MV 생성이 15초를 넘는다.
      위에서 만든 cmt_mt 에 **등치 조인**으로 붙이면 같은 결과가 1초대에 나온다. */
first_spoke AS (
    SELECT s.mona_cd, c.dept_nm, MIN(s.taking_date) AS d
      FROM politician_speeches s
      JOIN cmt_mt c
        ON c.taking_date = s.taking_date
       AND c.conf_title  = s.conf_title
     WHERE s.role_kind IN ('member', 'chair')   -- 정부측·참고인 제외 (이름 매칭 오귀속)
     GROUP BY 1, 2
),
/* 🔴 소속 시작일 — **이력이 있으면 이력을, 없으면 첫 발언일을** 쓴다 (2026-08-15 이력 도입).
   `politician_committee_history` 는 배치가 매일 명단을 비교해 쌓는 관측 이력이다.
   ⚠️ `is_seed` 행은 제외한다 — 최초 적재분이라 `started_on` 이 NULL 이고, 있다 쳐도
      "언제부터인지 모름" 이라 근사보다 나을 게 없다.
   이력이 붙은 쌍부터 하나씩 정확해진다 (`start_exact`). 지금은 전부 시드라 전부 근사다. */
hist AS (
    SELECT mona_cd, dept_nm, MAX(started_on) AS d
      FROM politician_committee_history
     WHERE ended_on IS NULL AND NOT is_seed AND started_on IS NOT NULL
     GROUP BY 1, 2
),
/* base 를 **현재 명단(politician_committees)** 에서 시작하는 게 중요하다.
   발언 기록에서 시작하면 "배정됐지만 아직 한 번도 발언 안 한 사람" 이 통째로 사라진다.
   이력이 정확해지면 그런 사람도 `0 / N` 으로 정직하게 드러나야 한다. */
base AS (
    SELECT pc.mona_cd
         , pc.dept_nm
         , pc.job_res_nm
         , COALESCE(h.d, fs.d)          AS window_start
         , (h.d IS NOT NULL)            AS start_exact
      FROM politician_committees pc
      LEFT JOIN hist        h  ON h.mona_cd  = pc.mona_cd AND h.dept_nm  = pc.dept_nm
      LEFT JOIN first_spoke fs ON fs.mona_cd = pc.mona_cd AND fs.dept_nm = pc.dept_nm
),
/* 분모(그 위원회 회의)와 분자(그중 발언한 회의)를 한 번에 센다.
   ⚠️ cmt_mt 를 먼저 걸고 speeches 를 LEFT JOIN 해야 **발언 0건도 0/N 으로 남는다.**
      speeches 부터 걸면 0건인 사람이 행 자체를 잃는다. */
x AS (
    SELECT b.mona_cd
         , b.dept_nm
         , b.job_res_nm
         , b.window_start                                          AS proxy_start
         , b.start_exact
         , COUNT(DISTINCT (c.taking_date, c.conf_title))::int      AS denom
         , COUNT(DISTINCT (s.taking_date, s.conf_title))
             FILTER (WHERE s.mona_cd IS NOT NULL)::int             AS spoke
         , COUNT(DISTINCT (s.taking_date, s.conf_title))
             FILTER (WHERE s.role_kind = 'chair')::int             AS chair_meetings
      FROM base b
      JOIN cmt_mt c
        ON c.dept_nm     = b.dept_nm
       AND c.taking_date >= b.window_start
      LEFT JOIN politician_speeches s
        ON s.mona_cd    = b.mona_cd
       AND s.taking_date = c.taking_date
       AND s.conf_title  = c.conf_title
       AND s.role_kind IN ('member', 'chair')
     WHERE b.window_start IS NOT NULL   -- 이력도 발언도 없으면 시작점을 모른다 → 제외
     GROUP BY 1, 2, 3, 4, 5
)
SELECT x.mona_cd
     , x.dept_nm
     , x.job_res_nm
     , x.proxy_start
     , x.start_exact
     , x.spoke
     , x.chair_meetings
     , x.denom
     , ROUND(100.0 * x.spoke / NULLIF(x.denom, 0), 1)             AS rate
       /* 코호트 = "평균" 을 계산할 모집단. 여기서 빠지는 셋:
            · 분모 11개 미만  — 위 100% 인플레이션 구간
            · 위원장          — 사회를 보는 자리라 성격이 다르다 (아래 실측 주석 참조)
            · 장관·총리·의장단 — 상임위 활동이 줄어드는 게 당연하다. 게으름으로 읽히면 안 된다
            · 퇴임 의원        — 임기가 끝나 분모만 늘어난다 */
     , (x.denom >= 11
        AND x.job_res_nm IS DISTINCT FROM '위원장'
        AND p.active_yn
        AND NOT EXISTS (SELECT 1 FROM politician_titles t
                         WHERE t.mona_cd = x.mona_cd
                           AND t.category IN ('국무위원', '의장단')))  AS in_cohort
  FROM x
  JOIN politicians p ON p.mona_cd = x.mona_cd;

-- REFRESH ... CONCURRENTLY 에 필수 (갱신 중에도 의원 상세가 안 막힘)
CREATE UNIQUE INDEX ux_pcs_mona_dept ON politician_committee_speech (mona_cd, dept_nm);
CREATE INDEX idx_pcs_cohort ON politician_committee_speech (rate) WHERE in_cohort;

COMMENT ON MATERIALIZED VIEW politician_committee_speech IS
  '의원별 상임위 발언 참여율. 소속 시작을 "그 위원회 첫 발언일" 로 근사하고 이후 회의를 분모로 삼는다. '
  '⚠️ in_cohort=false 인 행은 평균 계산에서 빼야 한다 (분모 11개 미만·위원장·장관·퇴임). '
  '⚠️ 국정감사·본회의는 제목에 위원회명이 없어 분모에서 빠진다 — "상임위 회의" 참여율이다.';
COMMENT ON COLUMN politician_committee_speech.proxy_start IS
  '분모를 세기 시작한 날. start_exact=TRUE 면 politician_committee_history 의 관측 배정일, '
  'FALSE 면 **근사값**(그 위원회 첫 발언일)이다.';
COMMENT ON COLUMN politician_committee_speech.start_exact IS
  'TRUE = 소속 이력에서 온 시작일 (배치가 명단 변화를 실제로 관측한 날). '
  'FALSE = 첫 발언일 근사 — **첫 발언 전 침묵기가 분모에서 빠져 값이 실제보다 후하다.** '
  '화면의 해석 주의 문구를 이 값으로 분기할 것. 이력이 쌓이면 TRUE 비율이 올라간다.';

-- 실측 (2026-08-15):
--   388쌍 / 코호트 164쌍(151명) · 평균 49.7% · 중앙값 50.7% · 평균 분모 46개
--   ⚠️ 위원장을 코호트에서 뺀 것은 **예방적 조치**다. 실측상 위원장이 더 높지 않았다
--      (분모 11+ 기준 중앙값: 간사 54.3 · 위원 50.0 · **위원장 48.7**). 6쌍뿐이라 평균에 영향도 없다.
--      그래도 빼두는 이유는 "사회 보는 자리가 평균을 올렸다" 는 반론 자체를 없애기 위함이다.
--
-- 갱신: batch/refreshCommitteeSpeech.js (syncSpeeches·syncCommittees 다음)
-- 검증:
--   SELECT COUNT(*) FILTER (WHERE in_cohort), COUNT(*) FROM politician_committee_speech;
--   SELECT ROUND(AVG(rate),1) FROM politician_committee_speech WHERE in_cohort;
