/* 정치인 상세정보 */
select p.politician_id
     , p.party_id
     , p.party_name
     , p.name
     , p.eng_nm
     , p.electoral_district
     , p.photo_url
     , p.birthday
     , p.reele_gbn_nm
     , p.mem_title
     , p.mona_cd 
  from politicians p
 where p.mona_cd = ?