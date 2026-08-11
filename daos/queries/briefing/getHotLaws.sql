/* 브리핑 — 이번 주 같은 법률에 개정안이 몰린 것
   $1: window_days (int)
   $2: limit (int)

   이 블록이 브리핑의 고유 가치다. /xray(누적 통계)에도 /bill(검색 도구)에도 없다.
   "이번 주 조세특례제한법에만 11건" 같은 사실에서 그 주의 관심사가 그냥 드러난다.
   AI 없이 SQL 만으로 서사가 나오는 유일한 지점.

   series_total 은 22대 전체 계열 건수 — "이번 주 11건 / 누적 788건" 처럼
   이번 주 몰림이 평소 대비 어느 정도인지 가늠하게 해준다.
   idx_bills_bill_name_btree 가 있어서 서브쿼리가 Index Only Scan 으로 돈다. */
SELECT b.bill_name
     , COUNT(*)::int AS week_cnt
     , (SELECT COUNT(*) FROM bills s WHERE s.bill_name = b.bill_name)::int AS series_total
     , MAX(b.committee) FILTER (WHERE b.committee IS NOT NULL AND b.committee <> '') AS committee
  FROM bills b
 WHERE b.propose_dt > CURRENT_DATE - $1::int
 GROUP BY b.bill_name
HAVING COUNT(*) > 1
 ORDER BY week_cnt DESC, series_total DESC
 LIMIT $2::int
