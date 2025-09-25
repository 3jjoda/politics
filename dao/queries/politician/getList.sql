/* 정치인 목록 */
select p.politician_id
     , p.party_id
     , p.party_name
     , p.politician_type
     , fn_get_code_name(p.politician_type) as politician_type_name
     , p.name
     , p.eng_nm
     , p.electoral_district
     , p.photo_url
     , p.birthday
     , p.reele_gbn_nm
     , p.mona_cd 
  from politicians p