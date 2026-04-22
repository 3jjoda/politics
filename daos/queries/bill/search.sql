/* 법안 검색 (커뮤니티 첨부용)
   $1: 검색어
*/
SELECT bill_id
     , bill_no
     , bill_name
     , proc_result_name
     , committee
     , TO_CHAR(propose_dt, 'YYYY-MM-DD') AS propose_dt
  FROM bills
 WHERE bill_name ILIKE '%' || $1 || '%'
 ORDER BY propose_dt DESC NULLS LAST
 LIMIT 10
