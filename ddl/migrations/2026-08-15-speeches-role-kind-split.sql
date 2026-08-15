-- 2026-08-15 `politician_speeches.role_kind` — 구 `gov` 를 셋으로 분리
--
-- ⚠️ 실행 순서: **`node batch/syncSpeeches.js --full` 을 먼저 돌린 뒤** 이 파일을 실행한다.
--    값을 바꾸는 건 배치(UPSERT)고 이 파일은 **제약과 주석만** 건다. 순서를 바꾸면 CHECK 가 걸리지 않는다.
--
-- 배경 — 라벨 문제가 아니라 **귀속** 문제였다:
--   구버전은 위원장/위원 계열이 아니면 전부 `gov` 로 몰았다. 화면에 `국무위원석 답변` 이라
--   라벨을 붙였더니 **참고인 1건짜리 의원이 장관처럼 표시됐다.**
--   원인은 소스 API(`npeslxqbanwkimebr`)가 MONA_CD 를 주지 않아 **이름으로만 매칭**한다는 데 있다.
--   외부 직위는 현역 의원과 이름이 겹친다 — 실측:
--     도지사 김영환 87건 · 회장 김병주 21건 · 변호사 김종민 15건 · 교수 박은정 7건
--   전부 **동명의 다른 사람**이다.
--
-- 🔴 여기서 나온 원칙:
--   `위원장`·`위원`·`간사`·`국회의장` 같은 직위는 **국회의원만 가질 수 있어** 이름 충돌이
--   구조적으로 없다. 그 밖의 직위는 외부인이 가질 수 있어 이름 매칭이 위험하다.
--   → 화면에는 `member`·`chair` 만 쓴다. 나머지 셋은 "왜 의정활동이 아닌지" 를 남기는 기록이다.
--
--   ⚠️ `government` 안에도 오귀속이 있다 (김문수 고용노동부장관 88건 — 동명의 현역 의원이 따로 있다).
--      세분해도 이름 매칭의 한계는 사라지지 않는다. **그래서 화면에서 배제하는 것이지, 세분했으니
--      쓸 수 있게 된 게 아니다.**
--
-- 값 (2026-08-15 --full 실측 · 총 66,882행):
--   member     40,386   질의석 — 의정활동
--   chair      21,591   위원장석(사회) — 안건 호명이라 구조적으로 많다. 반드시 분리해서 볼 것
--   government  4,354   정부측 (구 gov 의 대부분)
--   other         548   도지사·교수·회장·사장 등 — **대부분 동명이인 오귀속**
--   witness         3   참고인·증인·진술인 — 위와 같음

ALTER TABLE politician_speeches
  DROP CONSTRAINT IF EXISTS politician_speeches_role_kind_check;

ALTER TABLE politician_speeches
  ADD CONSTRAINT politician_speeches_role_kind_check
  CHECK (role_kind IN ('chair', 'member', 'government', 'witness', 'other'));

COMMENT ON COLUMN politician_speeches.role_kind IS
  'chair=위원장석(사회) / member=질의석(의정활동) / government=정부측 / witness=참고인·증인 / other=그 외 외부 직위. '
  '⚠️ 화면·집계에는 member·chair 만 쓴다. 나머지 셋은 소스가 MONA_CD 를 주지 않아 이름으로만 '
  '매칭한 결과라 동명이인 오귀속이 섞여 있다 (도지사 김영환 87건 등 — 전부 다른 사람).';

-- 검증
--   ① 구 값이 남아 있지 않아야 한다 (남아 있으면 --full 을 안 돌린 것)
--        SELECT COUNT(*) FROM politician_speeches WHERE role_kind = 'gov';   -- 0 이어야 함
--   ② 분포
--        SELECT role_kind, COUNT(*) FROM politician_speeches GROUP BY 1 ORDER BY 2 DESC;
--   ③ other/witness 가 정말 오귀속인지 눈으로 확인 (전부 동명의 외부인이어야 정상)
--        SELECT s.role, p.name, COUNT(*) FROM politician_speeches s
--          JOIN politicians p ON p.mona_cd = s.mona_cd
--         WHERE s.role_kind IN ('other','witness') GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20;
