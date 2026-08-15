/* 정치인 상세 - 법안 활동 탭 **한 페이지**.
   🔴 `getBillsByMonaCd.sql`(전건)을 대체하는 지연 로딩용이다.
      전건을 SSR 로 뿌리면 887행 × ~1.2KB = **페이지가 1.1MB** 가 된다 (실측 강경숙).
      화면은 한 번에 20행만 보여주므로 그만큼만 내려보낸다.

   인자: $1 mona_cd · $2 kind('all'|'rep'|'co') · $3 limit · $4 offset

   ⚠️ `kind` 는 **화이트리스트 키**로만 들어온다 (컨트롤러가 검증). SQL 에 문자열을 끼워넣지 말 것 —
      /xray/chart 에서 세운 원칙과 같다.
   ⚠️ 정렬은 전건 쿼리와 **같아야** 한다 (propose_dt DESC NULLS LAST, bill_id DESC).
      다르면 페이지를 넘길 때 같은 법안이 다시 나오거나 건너뛴다.
*/
SELECT b.bill_id
     , b.bill_name
     , b.committee
     , TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS propose_dt
     , b.proc_result_name
     , (b.mona_cd = $1) AS proposer_yn
     , (CURRENT_DATE - b.propose_dt)::int AS days_elapsed
     , (SELECT vote_result FROM bill_votes
         WHERE bill_id = b.bill_id AND mona_cd = $1 LIMIT 1) AS my_vote_result
  FROM bills b
 WHERE (b.mona_cd = $1
        OR b.bill_id IN (SELECT bill_id FROM bill_co_proposers WHERE mona_cd = $1))
   AND ($2 = 'all'
        OR ($2 = 'rep' AND b.mona_cd = $1)
        OR ($2 = 'co'  AND b.mona_cd IS DISTINCT FROM $1))
 ORDER BY b.propose_dt DESC NULLS LAST, b.bill_id DESC
 LIMIT $3 OFFSET $4
