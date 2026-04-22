/* 홈 KPI */
SELECT
  (SELECT COUNT(*) FROM bills)                                                              AS total_bills,
  (SELECT COUNT(*) FROM bills WHERE proc_result_name IS NOT NULL AND proc_result_name != '') AS processed_bills,
  (SELECT COUNT(*) FROM bills WHERE proc_result_name IS NULL OR proc_result_name = '')      AS pending_bills,
  (SELECT COUNT(*) FROM politicians WHERE active_yn = TRUE)                                 AS total_politicians,
  (SELECT COUNT(*) FROM bill_votes)                                                         AS total_votes,
  (SELECT COUNT(*) FROM bill_co_proposers)                                                  AS total_co_proposers
