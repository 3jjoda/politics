/* 정치인 목록 */
SELECT p.politician_id
     , p.party_id
     , p.party_name
     , p.politician_type
     , c.code_name   AS politician_type_name
     , p.name
     , p.eng_nm
     , p.electoral_district
     , p.photo_url
     , p.birthday
     , p.reele_gbn_nm
     , p.mona_cd 
  FROM politicians p
  JOIN codes c
    ON c.code_id = p.politician_type