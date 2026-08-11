/* 관리자 — 의원 선택 드롭다운용 목록
   mona_cd 를 손으로 찾지 않게 하는 것이 관리자 페이지의 핵심 이득이다.
   309명이라 native select 로 충분하다 (브라우저 타이핑 검색이 먹는다). */
SELECT p.mona_cd
     , p.name
     , COALESCE(p.party_name, '무소속')     AS party_name
     , COALESCE(p.electoral_district, '—')  AS district
  FROM politicians p
 WHERE p.active_yn = TRUE
 ORDER BY p.name, p.mona_cd
