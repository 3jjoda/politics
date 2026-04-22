/* 홈 - 활발한 의원 TOP 5 (법안 발의 수 기준) */
SELECT p.mona_cd
     , p.name
     , p.party_name
     , p.electoral_district
     , p.photo_url
     , COUNT(b.bill_id) AS propose_cnt
  FROM politicians p
  JOIN bills b ON b.mona_cd = p.mona_cd
 WHERE p.active_yn = TRUE
 GROUP BY p.mona_cd, p.name, p.party_name, p.electoral_district, p.photo_url
 ORDER BY propose_cnt DESC
 LIMIT 5
