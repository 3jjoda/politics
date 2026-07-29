/* X레이 ④ 법안 생존율 깔때기 — 전체/처리/가결/대안반영/부결·폐기·철회 */
SELECT COUNT(*)::int AS total
     , COUNT(*) FILTER (WHERE proc_result_name IS NOT NULL AND proc_result_name <> '')::int AS processed
     , COUNT(*) FILTER (WHERE proc_result_name IN ('원안가결','수정가결'))::int AS passed
     , COUNT(*) FILTER (WHERE proc_result_name IN ('대안반영폐기','수정안반영폐기'))::int AS alt_reflected
     , COUNT(*) FILTER (WHERE proc_result_name IN ('부결','폐기','철회'))::int AS rejected
  FROM bills
