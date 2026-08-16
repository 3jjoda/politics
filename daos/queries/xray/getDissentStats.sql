/* X레이 — 당론 이탈 요약 (TOP 15 목록 위에 얹는 결론)
 *
 * 순위표만 있으면 "1위가 3.5%" 를 보고도 그게 높은지 낮은지 알 수 없다.
 * 🔴 이 섹션의 결론은 **이탈이 드물다**는 것이다 — 중앙값과 "이탈 0회" 인원이 그걸 말한다.
 * ⚠️ 모집단은 MV 와 같다 (당론 판정이 가능한 의원). TOP 15 와 분모가 어긋나면 안 된다.
 */
SELECT COUNT(*)::int                                                                        AS total
     , ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dissent_rate) * 100)::numeric, 1) AS median_pct
     , ROUND((MAX(dissent_rate) * 100)::numeric, 1)                                         AS max_pct
     , COUNT(*) FILTER (WHERE dissent_cnt = 0)::int                                         AS never_cnt
     , SUM(dissent_cnt)::int                                                                AS dissent_sum
     , SUM(votes_cnt)::int                                                                  AS votes_sum
  FROM politician_dissent
