/* 법안 상세 - 발의자 목록 (대표 + 공동) */
SELECT cp.mona_cd
     , cp.proposer_yn
     , p.name
     , p.party_name
     , p.photo_url
  FROM bill_co_proposers cp
  LEFT JOIN politicians p ON p.mona_cd = cp.mona_cd
 WHERE cp.bill_id = $1
 ORDER BY cp.proposer_yn DESC, p.name
