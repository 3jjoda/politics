/* 정치인 상세 - **한 달치** 본회의 표결 내역 (월별 표결 참여 차트의 클릭 패널용).
   🔴 예전엔 598건 전건을 `window.__VOTE_MONTHS__` JSON 으로 심었다 — **75KB**.
      실제로 보는 건 클릭한 달 하나뿐이라 그 달만 가져온다.
   ⚠️ 정렬은 표결일 → 법안ID. 같은 달 안에서도 순서가 안정적이어야 페이징이 어긋나지 않는다. */
SELECT bv.bill_id
     , bv.vote_result
     , b.bill_name
     /* 발의 정당 — 표결 내역 탭과 **같은 이유**로 준다 (2026-09-01).
        누가 낸 법안인지가 없으면 "불참한 게 다 특정 당 법안" 이라는 인상이 생기는데,
        본회의 표결 법안의 42.1%가 원래 국민의힘 발의라 무작위로 봐도 그렇게 보인다.
        ⚠️ 컬럼 이름을 `getVotesPageByMonaCd.sql` 과 맞춘다 — 두 화면이 같은 행 마크업을 쓴다 */
     , b.proposer_name AS bill_proposer
     , bp.party_name   AS bill_party
  FROM bill_votes bv
  LEFT JOIN bills b ON b.bill_id = bv.bill_id
  LEFT JOIN politicians bp ON bp.mona_cd = b.mona_cd
 WHERE bv.mona_cd = $1
   AND TO_CHAR(bv.vote_date, 'YYYY-MM') = $2
 ORDER BY bv.vote_date DESC, bv.bill_id DESC
