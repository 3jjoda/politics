-- 전체 기준선 — 쟁점 지표를 비교할 상대값 (쟁점과 무관하므로 서비스가 따로 캐시한다)
--
-- 🔴 이 값이 없으면 쟁점 숫자는 총량일 뿐이다. "위원회 처리 5%" 는 전체가 26.2% 라는 걸 알아야 사실이 된다.
-- ⚠️ 전건 스캔이라 무겁다 (실측 18,830행). **반드시 캐시할 것** — 배치가 하루 한 번 바꾸는 값이다.
-- ⚠️ 인물·사건명 특검법을 여기서도 뺀다 ($1) — 쟁점 쪽과 같은 모수여야 비교가 성립한다.
WITH scope AS (
    SELECT bill_id, cmt_proc_dt, propose_dt, proc_result_name
      FROM bills
     WHERE bill_name !~ $1
), cross_party AS (
    SELECT s.bill_id
      FROM scope s
      JOIN bill_co_proposers c ON c.bill_id = s.bill_id
      JOIN politicians p       ON p.mona_cd = c.mona_cd
     GROUP BY s.bill_id
    HAVING COUNT(*) FILTER (WHERE p.party_name = '더불어민주당') > 0
       AND COUNT(*) FILTER (WHERE p.party_name = '국민의힘')     > 0
), signed AS (
    SELECT DISTINCT s.bill_id FROM scope s JOIN bill_co_proposers c ON c.bill_id = s.bill_id
)
SELECT (SELECT COUNT(*) FROM scope)::int                                   AS total,
       (SELECT COUNT(*) FROM scope WHERE cmt_proc_dt IS NOT NULL)::int     AS cmt_done,
       (SELECT COUNT(*) FROM signed)::int                                  AS signed_total,
       (SELECT COUNT(*) FROM cross_party)::int                             AS cross_party,
       (SELECT ROUND(AVG(CURRENT_DATE - propose_dt)) FROM scope
         WHERE proc_result_name IS NULL)::int                              AS pending_days
