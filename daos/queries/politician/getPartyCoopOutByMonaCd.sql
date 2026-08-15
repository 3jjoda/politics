/* 정치인 상세 - 내가 **참여한** 법안의 대표발의자 정당 분포 (outbound)
   = 다른 의원이 대표발의한 법안에 내가 공동발의로 이름을 올린 것.

   🔴 `getPartyCoopByMonaCd.sql`(inbound: 내 법안에 누가 합류했나)과 **방향이 반대다.**
      의원 상세는 "이 사람이 어떻게 행동했나" 를 보는 자리라 **이쪽이 본인의 선택**이고,
      inbound 는 남들이 이 사람을 어떻게 대했나다. 둘 다 보여주되 순서는 outbound 가 먼저.

   ⚠️ 세는 단위가 inbound 와 다르다:
        여기(outbound) = **법안 건수** — 한 법안에 내가 이름을 올리는 건 한 번뿐이다
        inbound        = (법안 × 의원) **쌍의 횟수** — 한 법안에 여러 의원이 올린다
      화면에서 단위를 각각 `건` / `회` 로 구분해 쓸 것. 섞으면 두 패널의 합계가 왜 다른지 설명이 안 된다.
      (실측 강경숙: outbound 798건 = 공동발의 건수와 정확히 일치 / inbound 976회)

   ⚠️ 폴백 `명부 없음` 은 politicians 에 없는 대표발의자 = 대개 퇴임 의원이다 (전체 221,963건 중 4,209건).
      `bills.mona_cd` 자체가 NULL 인 경우는 실측 **0건**이라 따로 분기하지 않는다 —
      공동발의자가 있는 법안은 대표발의자가 항상 기록돼 있다.
*/
SELECT COALESCE(lp.party_name, '명부 없음') AS party_name
     , COUNT(*) AS cnt
  FROM bill_co_proposers cp
  JOIN bills b ON b.bill_id = cp.bill_id
  LEFT JOIN politicians lp ON lp.mona_cd = b.mona_cd
 WHERE cp.mona_cd = $1
   AND cp.proposer_yn = FALSE
 GROUP BY COALESCE(lp.party_name, '명부 없음')
 ORDER BY cnt DESC
