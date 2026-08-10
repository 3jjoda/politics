/* X레이 — 월별 대표발의 건수 + 그 달 법안의 처리 진행도.

   "월별 발의량"만 그리면 높은 막대가 열심히 일한 건지 무더기로 올린 건지 구분이 안 된다.
   그래서 같은 달 법안이 **지금 어디까지 처리됐는지**를 함께 낸다.

   ⚠️ 최근 달일수록 processed 가 0 에 수렴한다 — 아직 심사 중이라서다 (실측: 2026-05 발의 254건 중
      처리 완료 1건). 이걸 "가결률 하락"으로 그리면 명백한 오독을 유도하므로,
      화면에서는 반드시 처리 진행도를 같이 보여줄 것.

   기준: 대표발의자(mona_cd)가 있는 법안만. 위원장 대안 등 대표발의자 미상은 제외. */
SELECT TO_CHAR(propose_dt, 'YYYY-MM')                                          AS ym
     , COUNT(*)::int                                                            AS proposed
     , COUNT(DISTINCT mona_cd)::int                                             AS proposers
     , COUNT(*) FILTER (WHERE proc_result_name IS NOT NULL)::int                AS processed
     , COUNT(*) FILTER (WHERE proc_result_name IN ('원안가결','수정가결'))::int AS passed
  FROM bills
 WHERE propose_dt IS NOT NULL
   AND mona_cd IS NOT NULL
 GROUP BY 1
 ORDER BY 1
