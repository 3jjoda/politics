/* 정치인 상세 - 표결 내역 탭 **한 페이지** (+ 결과별 필터)
   🔴 `votes.slice(0, 50)` 을 대체한다. 예전엔 전건(598건)을 읽어놓고 **50건만 그렸고,
      나머지 548건은 도달할 방법이 아예 없었다.** 행 하나가 630B 라 전건을 뿌리면 +345KB.

   인자: $1 mona_cd · $2 result('all'|'찬성'|'반대'|'기권'|'불참') · $3 limit · $4 offset

   ⚠️ `result` 는 **화이트리스트 키**로만 들어온다 (서비스가 검증). SQL 에 문자열을 끼워넣지 말 것.
   🔴 **정렬에 tiebreaker 가 필수고, `getVotesByMonaCd.sql`(전건)과 같아야 한다.**
      같은 날 표결이 수십 건이라 `vote_date DESC` 만으로는 순서가 고정되지 않는다.
      탭은 전건 결과의 앞 20건을 SSR 하고 "더 보기" 는 이 쿼리를 쓰므로, 두 정렬이 갈리면
      **경계에서 행이 중복되거나 건너뛴다** — 실제로 3건이 중복됐다 (2026-08-16).
   총 건수는 `COUNT(*) OVER()` 로 같이 낸다 (페이지 수 계산에 왕복을 더하지 않으려고).
*/
SELECT bv.bill_id
     , bv.bill_no
     , bv.vote_result
     , TO_CHAR(bv.vote_date, 'YYYY-MM-DD') AS vote_date
     , b.bill_name
     , b.proc_result_name
     , b.committee AS bill_topic_nm
     , COUNT(*) OVER() AS total_count
  FROM bill_votes bv
  LEFT JOIN bills b ON b.bill_id = bv.bill_id
 WHERE bv.mona_cd = $1
   AND ($2 = 'all' OR bv.vote_result = $2)
 ORDER BY bv.vote_date DESC, bv.bill_id DESC
 LIMIT $3 OFFSET $4
