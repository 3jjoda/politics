/* 정치인 목록 */
SELECT p.politician_id
     , p.politician_type
     , c.code_name   AS politician_type_name
     , p.party_id
     , p.photo_url
     , p.name
     , p.hj_nm
     , p.eng_nm
     , p.bth_gbn_nm
     , p.birthday
     , p.job_res_nm
     , p.electoral_district
     , p.elect_gbn_nm
     , p.cmit_nm
     , p.cmits
     , p.reele_gbn_nm
     , p.units
     , p.sex_gbn_nm
     , p.tel_no
     , p.e_mail
     , p.homepage
     , p.staff
     , p.secretary
     , p.secretary2
     , p.mona_cd
     , p.mem_title
     , p.assem_addr
     , p.created_at
     , p.updated_at
     , p.active_yn
     , p.party_name
     , p.last_vote_api_count
     , p.last_bill_api_count
  FROM politicians p
  JOIN codes c
    ON c.code_id = p.politician_type