/* X레이 ⑤-a 초당적 공동발의 — 공동발의진에 2개 이상 정당이 포함된 법안 비율 */
WITH bill_parties AS (
    SELECT cp.bill_id, COUNT(DISTINCT p.party_id)::int AS party_cnt
      FROM bill_co_proposers cp
      JOIN politicians p ON p.mona_cd = cp.mona_cd
     GROUP BY cp.bill_id
)
SELECT COUNT(*)::int AS total_bills
     , COUNT(*) FILTER (WHERE party_cnt >= 2)::int AS multi_party_bills
  FROM bill_parties
