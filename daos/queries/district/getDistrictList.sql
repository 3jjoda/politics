-- 지역구 선택 목록 — 시도 그룹 + 지역구명
--
-- 🔴 **시도는 파싱이 아니라 보정이다.** 대부분 `첫 어절 + 공백 + 지역구` 지만 예외가 있다 (실측 2026-08-23):
--      `세종특별자치시갑` / `세종특별자치시을` — **공백이 없다** (2건)
--      `전남광주통합특별시 광산구갑` — 첫 어절이 통합 행정구역명이라 길다 (18건, 정상)
--    공백이 없으면 CASE 로 접두를 잘라낸다. 새 예외가 생기면 여기 한 줄.
-- ⚠️ **비례대표는 뺀다** — 지역구가 아니다 (실측 46명).
-- ⚠️ 현직·퇴임을 가리지 않고 지역구를 낸다. 한 지역구에 현직+퇴임이 같이 있는 곳이 8군데라
--    DISTINCT 로 접는다. 어느 의원을 보여줄지는 getByDistrict.sql 이 정한다.
SELECT DISTINCT
       electoral_district AS district,
       CASE
         WHEN electoral_district LIKE '세종%' THEN '세종'
         WHEN POSITION(' ' IN electoral_district) > 0
              THEN SPLIT_PART(electoral_district, ' ', 1)
         ELSE electoral_district
       END AS sido
  FROM politicians
 WHERE electoral_district IS NOT NULL
   AND electoral_district <> '비례대표'
 ORDER BY sido, district
