/* 정치인 상세 - 정당별 공동발의 협력 현황
   해당 의원이 대표발의한 법안들에 공동발의한 의원들의 정당 분포.
   ⚠️ 세는 단위는 **(법안 × 의원) 쌍**이다 — 한 의원이 여러 법안에 이름을 올리면 여러 번 센다.
      화면에 "명" 이라고 쓰면 거짓이 된다 (실측 강경숙: 대표발의 87건에 976쌍).

   🔴 폴백 라벨은 `명부 없음` 이다. `기타/무소속` 으로 두면 **실제 정당인 `무소속` 과 나란히 떠서
      구분이 안 된다** (실측 강경숙: 명부 없음 44 / 무소속 11 — 둘 다 존재).
      /xray/chart 에서 이미 같은 판단을 했다 (CLAUDE.md "정당 폴백 라벨은 '명부 없음'").
      여기서 `명부 없음` 은 politicians 에 없는 사람 = 대개 퇴임 의원이다.
*/
SELECT COALESCE(p.party_name, '명부 없음') AS party_name
     , COUNT(*) AS cnt
  FROM bills b
  JOIN bill_co_proposers cp ON cp.bill_id = b.bill_id AND cp.proposer_yn = FALSE
  LEFT JOIN politicians p ON p.mona_cd = cp.mona_cd
 WHERE b.mona_cd = $1
 GROUP BY COALESCE(p.party_name, '명부 없음')
 ORDER BY cnt DESC
