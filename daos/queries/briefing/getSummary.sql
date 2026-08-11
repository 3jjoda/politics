/* 브리핑 — 최근 N일 요약 KPI
   $1: window_days (int)

   "발의 있는 날" 이 평일에만 있어서 기간 평균은 전체 일수가 아니라 활동일 기준으로 낸다.
   (60일 중 발의 있는 날이 39일 = 65%. 전체 일수로 나누면 실제보다 낮게 보인다) */
SELECT COUNT(*)::int                                   AS proposed
     , COUNT(DISTINCT b.propose_dt)::int               AS active_days
     , COUNT(DISTINCT b.mona_cd)::int                  AS proposers
     , COALESCE(SUM(b.co_proposer_count), 0)::int      AS co_signatures
     , COUNT(*) FILTER (WHERE b.committee_dt IS NULL)::int AS awaiting_referral
  FROM bills b
 WHERE b.propose_dt > CURRENT_DATE - $1::int
