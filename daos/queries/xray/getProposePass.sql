/* X레이 ③ 발의왕 vs 입법왕 — 현직 의원별 대표발의 건수와 가결(원안+수정) 건수. 5건 이상 발의자만 */
SELECT p.mona_cd, p.name, p.party_name
     , COUNT(b.bill_id)::int AS proposed
     , COUNT(*) FILTER (WHERE b.proc_result_name IN ('원안가결','수정가결'))::int AS passed
  FROM politicians p
  JOIN bills b ON b.mona_cd = p.mona_cd
 WHERE p.active_yn = TRUE
 GROUP BY p.mona_cd, p.name, p.party_name
HAVING COUNT(b.bill_id) >= 5
