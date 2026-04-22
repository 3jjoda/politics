/* 법안 상태별 카운트 (상태 탭용) */
SELECT
  COUNT(*)                                                                               AS total,
  COUNT(*) FILTER (WHERE proc_result_name IS NULL OR proc_result_name = '')              AS pending,
  COUNT(*) FILTER (WHERE proc_result_name = '원안가결')                                   AS passed_orig,
  COUNT(*) FILTER (WHERE proc_result_name = '수정가결')                                   AS passed_mod,
  COUNT(*) FILTER (WHERE proc_result_name = '대안반영폐기')                               AS alt_dropped,
  COUNT(*) FILTER (WHERE proc_result_name = '철회')                                       AS withdrawn,
  COUNT(*) FILTER (WHERE proc_result_name = '폐기')                                       AS dropped,
  COUNT(*) FILTER (WHERE proc_result_name = '부결')                                       AS rejected
  FROM bills
