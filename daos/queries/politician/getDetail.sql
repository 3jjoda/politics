/* 정치인 상세정보 */
SELECT p.politician_id
     , p.party_id
     , p.party_name
     , p.name
     , p.hj_nm
     , p.eng_nm
     , p.electoral_district
     , p.photo_url
     , p.cmit_nm
     , p.cmits
     , p.elect_gbn_nm
     , p.reele_gbn_nm
     , p.units
     , p.sex_gbn_nm
     , p.tel_no
     , p.e_mail
     , p.homepage
     , p.assem_addr
     , p.mem_title
     , p.mona_cd
     , TO_CHAR(p.birthday, 'YYYY-MM-DD') AS birthday
     , (
        EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday)
        -
        (CASE
           WHEN TO_CHAR(CURRENT_DATE, 'MMDD') < TO_CHAR(p.birthday, 'MMDD') THEN 1
           ELSE 0
         END)
       ) AS age
     , (SELECT COUNT(*) FROM bills WHERE mona_cd = p.mona_cd) AS propose_cnt
     , (SELECT COUNT(*) FROM bill_co_proposers
         WHERE mona_cd = p.mona_cd AND proposer_yn = FALSE) AS co_propose_cnt
     , (SELECT COUNT(*) FROM bill_votes WHERE mona_cd = p.mona_cd) AS vote_cnt
     , (SELECT COUNT(*) FROM bills
         WHERE mona_cd = p.mona_cd
           AND proc_result_name IN ('원안가결','수정가결')) AS passed_cnt
  FROM politicians p
 WHERE p.mona_cd = $1
