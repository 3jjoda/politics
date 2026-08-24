-- 지역구 → 그 지역구 의원 (현직 우선)
--
-- 🔴 **현직(active_yn)을 먼저 준다.** 한 지역구에 현직 1 + 퇴임 1 인 곳이 8군데다
--    (보선으로 사람이 바뀐 곳 — 울산 남구갑 김태규/김상욱(퇴임) 등).
--    지역구를 저장하고 사람은 조회 시점에 찾는 이유가 이것이다.
-- ⚠️ 성향 좌표는 v2 3축이고 NULL 일 수 있다 (축당 서명 5건 미만). 화면이 NULL 을 처리한다.
--   $1 지역구명
SELECT p.mona_cd,
       p.name,
       COALESCE(p.party_name, '무소속') AS party_name,
       p.photo_url,
       p.electoral_district,
       p.reele_gbn_nm  AS reelected,
       p.active_yn,
       a.economy::float8      AS economy,
       a.social::float8       AS social,
       a.institution::float8  AS institution
  FROM politicians p
  LEFT JOIN politician_axis_score a
         ON a.mona_cd = p.mona_cd AND a.mapping_version = 'v2'
 WHERE p.electoral_district = $1
 ORDER BY p.active_yn DESC NULLS LAST, p.name
 LIMIT 1
