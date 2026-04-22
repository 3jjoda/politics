/* 법안 상세 - 표결한 의원 목록 */
SELECT bv.mona_cd
     , bv.vote_result
     , TO_CHAR(bv.vote_date, 'YYYY-MM-DD') AS vote_date
     , p.name
     , p.party_name
     , p.photo_url
  FROM bill_votes bv
  LEFT JOIN politicians p ON p.mona_cd = bv.mona_cd
 WHERE bv.bill_id = $1
 ORDER BY bv.vote_result, p.name
