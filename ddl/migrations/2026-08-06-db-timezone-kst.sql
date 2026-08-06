-- 2026-08-06 DB 세션 기본 타임존을 KST 로
--
-- 목적: SQL 에디터에서 timestamptz 가 UTC(+00) 로 보여 읽기 어려운 문제.
--       저장된 값은 원래 정확하다(timestamptz = 절대 시각). 표시 기본값만 바꾼다.
--
-- ⚠️ 이 설정은 pg_db_role_setting 에만 남는 "데이터베이스 속성" 이라
--    프로젝트를 새로 만들면 데이터와 함께 오지 않는다.
--    Supabase 리전 이전 등으로 DB 를 재생성하면 이 파일을 반드시 다시 실행할 것.
--    빠뜨려도 에러가 없다 — 모든 시각이 조용히 9시간 밀린다.

ALTER DATABASE postgres SET timezone TO 'Asia/Seoul';

-- 확인 (새 연결부터 반영됨 — 기존 세션·커넥션풀은 재접속 필요)
--   SELECT current_setting('TimeZone');                       -- → Asia/Seoul
--   SELECT setconfig FROM pg_db_role_setting s
--     JOIN pg_database d ON d.oid = s.setdatabase WHERE d.datname = 'postgres';

-- ---------------------------------------------------------------------------
-- 이 설정이 있어도 코드 규칙은 유지한다 (CLAUDE.md "날짜·시간 처리 규칙")
--
--   조회 — TO_CHAR / CURRENT_DATE: 명시하지 않는다. 이 설정에 위임
--                                    (2026-08-06 daos/queries 의 명시 변환 16곳 제거)
--   저장 — 달력 날짜 INSERT/UPDATE: (NOW() AT TIME ZONE 'Asia/Seoul')::date 를 **반드시** 명시
--                                    (batch/syncPoliticians.js 5곳)
--
-- 이유는 실패 방식이 다르기 때문:
--   · 읽기가 틀리면 화면에 보이고, 설정만 고치면 즉시 정상으로 돌아온다
--   · 쓰기가 틀리면 하루 어긋난 날짜가 영구 저장되고, 나중엔 틀린 줄도 알 수 없다
--     (politician_party_memberships.start_date / party_names_history.start_date)
-- ---------------------------------------------------------------------------
