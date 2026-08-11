/* 의원 소속 위원회 목록
   $1: mona_cd

   정렬 규칙 — 화면에서 중요한 것부터:
     1) 상임위 먼저, 특별위원회 나중 (특위는 한시 조직이고 이름도 길다)
     2) 같은 등급이면 직위 순 (위원장 → 간사 → 위원)
     3) 그 다음 이름순

   ⚠️ 이 테이블은 **현재 스냅샷**이라 과거 소속은 답할 수 없다 (politician_committees 주석 참조). */
SELECT pc.dept_cd
     , pc.dept_nm
     , pc.job_res_nm
     , pc.room_no
     , (pc.dept_nm LIKE '%특별위원회%') AS is_special
       /* /bill?committee= 로 링크를 걸 수 있는지 — **이름이 실제로 있는지 확인해서** 정한다.
          is_special 로 대신 판정하면 안 된다: 실측 23개 중 bills.committee 와 맞는 건 19개인데
          그 경계가 특위 여부와 정확히 겹친다는 보장이 없다 (특위 이름 표기가 바뀌면 어긋난다).
          링크를 걸었는데 결과가 0건인 페이지로 보내는 게 최악이라 존재 확인이 낫다. */
     , EXISTS (SELECT 1 FROM bills b WHERE b.committee = pc.dept_nm) AS has_bills
  FROM politician_committees pc
 WHERE pc.mona_cd = $1
 ORDER BY (pc.dept_nm LIKE '%특별위원회%')
        , CASE pc.job_res_nm WHEN '위원장' THEN 0 WHEN '간사' THEN 1 ELSE 2 END
        , pc.dept_nm
