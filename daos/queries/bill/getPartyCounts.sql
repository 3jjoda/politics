/* 법안 정당별 카운트 (대표발의자 기준) */
SELECT COALESCE(p.party_name, '기타/무소속') AS party_name
     , COUNT(*) AS cnt
  FROM bills b
  LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
 WHERE b.mona_cd IS NOT NULL
 GROUP BY COALESCE(p.party_name, '기타/무소속')
 ORDER BY cnt DESC
