/* 정치인 상세정보 */
SELECT p.politician_id
     , p.party_id
     , p.party_name
     , p.name
     , p.eng_nm
     , p.electoral_district
     , p.photo_url
     , TO_CHAR(p.birthday, 'YYYY-MM-DD') AS birthday
     , (-- 현재 연도에서 출생 연도를 뺀 기본 나이
        EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM p.birthday)
        -- 생일이 아직 지나지 않았으면 1을 뺌
        -
        (CASE -- 현재 월일(MMDD)이 생일 월일(MMDD)보다 작으면 (아직 생일 전)
                WHEN TO_CHAR(CURRENT_DATE, 'MMDD') < TO_CHAR(p.birthday, 'MMDD') THEN 1
                ELSE 0
            END
         )
       ) AS age
     , p.reele_gbn_nm
     , p.mem_title
     , p.mona_cd
  FROM politicians p
 WHERE p.mona_cd = $1