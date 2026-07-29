/* X레이 ⑥ 주도자 vs 서명러 — 현직 의원별 대표발의 vs 공동발의(서명) 건수 */
SELECT p.mona_cd, p.name, p.party_name
     , COUNT(*) FILTER (WHERE cp.proposer_yn = TRUE)::int AS rep_cnt
     , COUNT(*) FILTER (WHERE cp.proposer_yn = FALSE)::int AS co_cnt
  FROM bill_co_proposers cp
  JOIN politicians p ON p.mona_cd = cp.mona_cd
 WHERE p.active_yn = TRUE
 GROUP BY p.mona_cd, p.name, p.party_name
