/* 정치인 상세 - 정당별 공동발의 협력 현황
   해당 의원이 대표발의한 법안들에 공동발의한 의원들의 정당 분포
*/
SELECT COALESCE(p.party_name, '기타/무소속') AS party_name
     , COUNT(*) AS cnt
  FROM bills b
  JOIN bill_co_proposers cp ON cp.bill_id = b.bill_id AND cp.proposer_yn = FALSE
  LEFT JOIN politicians p ON p.mona_cd = cp.mona_cd
 WHERE b.mona_cd = $1
 GROUP BY COALESCE(p.party_name, '기타/무소속')
 ORDER BY cnt DESC
