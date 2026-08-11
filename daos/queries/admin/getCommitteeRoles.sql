/* 관리자 — 자동 수집되는 상임위 직위 (읽기 전용 참고)
   ⚠️ 이 값은 syncCommittees 가 매일 전체 교체한다. 관리자 화면에서 **편집하면 안 된다** —
      고쳐도 다음 배치에 덮인다. 화면에는 "여기는 자동" 이라고 알려주려고 보여줄 뿐이다. */
SELECT pc.job_res_nm
     , COUNT(*)::int AS cnt
  FROM politician_committees pc
 WHERE pc.job_res_nm IN ('위원장', '간사')
 GROUP BY 1
 ORDER BY CASE pc.job_res_nm WHEN '위원장' THEN 0 ELSE 1 END
