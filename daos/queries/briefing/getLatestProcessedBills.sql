/* 브리핑 — 가장 최근 처리일의 법안 샘플 (본회의/위원회 각 $1건)
   $1: per_stage limit (int)

   집계 숫자만 있으면 "10건 대안반영폐기" 로 끝나 무슨 법안인지 알 수 없다.
   실제 법안명을 몇 개 보여줘야 브리핑이 된다. */
WITH latest AS (
    SELECT MAX(proc_dt) AS floor_day, MAX(cmt_proc_dt) AS cmt_day FROM bills
), picked AS (
    SELECT 'floor' AS stage, b.bill_id, b.bill_name, b.proposer_name, b.committee
         , b.proc_result_name AS result, b.co_proposer_count
      FROM bills b, latest l
     WHERE b.proc_dt = l.floor_day
    UNION ALL
    SELECT 'committee', b.bill_id, b.bill_name, b.proposer_name, b.committee
         , b.cmt_proc_result, b.co_proposer_count
      FROM bills b, latest l
     WHERE b.cmt_proc_dt = l.cmt_day
)
SELECT stage, bill_id, bill_name, proposer_name, committee, result
  FROM (
      SELECT p.*, ROW_NUMBER() OVER (
                 PARTITION BY p.stage
                 ORDER BY p.co_proposer_count DESC NULLS LAST, p.bill_id
             ) AS rn
        FROM picked p
  ) t
 WHERE rn <= $1::int
 ORDER BY stage, rn
