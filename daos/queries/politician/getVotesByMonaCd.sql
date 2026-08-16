/* 정치인 상세 - 표결 내역 전건 (월별 추이 차트 + 탭 첫 페이지 SSR)
   🔴 정렬은 `getVotesPageByMonaCd.sql` 과 **반드시 같아야 한다** (vote_date DESC, bill_id DESC).
      이 파일이 `vote_date DESC` 뿐이던 시절, 탭은 이 결과의 앞 20건을 SSR 하고
      "더 보기" 는 tiebreaker 가 붙은 페이지 쿼리를 썼다 → 같은 날 표결의 순서가 갈려
      **경계에서 3건이 중복**됐다 (2026-08-16 실측). 한쪽만 고치지 말 것. */
SELECT bv.bill_id
     , bv.bill_no
     , bv.vote_result
     , TO_CHAR(bv.vote_date, 'YYYY-MM-DD') AS vote_date
     , b.bill_name
     , b.proc_result_name
     , b.committee AS bill_topic_nm
  FROM bill_votes bv
  LEFT JOIN bills b ON b.bill_id = bv.bill_id
 WHERE bv.mona_cd = $1
 ORDER BY bv.vote_date DESC, bv.bill_id DESC
