/* 공통코드 조회 */
SELECT code_id
     , group_code
     , code_name
     , description
  FROM codes
 WHERE use_yn = true