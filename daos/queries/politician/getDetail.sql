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
     /* 현역 API 에 없는 의원 — 히어로에 `퇴임` 배지로 표시한다.
        ⚠️ 상세는 원래부터 active_yn 으로 거르지 않았다(그래서 목록에 없어도 URL 로는 열렸다).
           그런데 표시가 없으면 퇴임자인지 모른 채 "왜 최근 활동이 없지" 로 읽힌다. */
     , p.active_yn
     , p.tel_no
     , p.e_mail
     , p.homepage
     , p.assem_addr
     , p.mem_title
       /* ⚠️ p.cmit_nm / p.cmits 는 전원 NULL 인 죽은 컬럼이니 쓰지 말 것.
          위원회 = politician_committees, 직위 = politician_titles (각각 getCommittees / getTitles) */
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
     , pa.economy::float8     AS axis_economy
     , pa.social::float8      AS axis_social
     , pa.security::float8    AS axis_security
     , pa.institution::float8 AS axis_institution
     , pa.mapping_version     AS axis_version
     , pa.vote_count_used     AS axis_vote_count
  FROM politicians p
  LEFT JOIN politician_axis_score pa
    ON pa.mona_cd = p.mona_cd AND pa.mapping_version = 'v1'
 WHERE p.mona_cd = $1
