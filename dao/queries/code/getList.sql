/* 공통코드 조회 */
select code_id
     , group_code
     , code_name
     , description
  from codes
 where use_yn = 1