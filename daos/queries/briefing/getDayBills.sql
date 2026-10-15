/* 그날 발의된 법안 **전건** — 브리핑 상세 「그날의 법안」 (2026-10-15)
   $1: briefing_date (YYYY-MM-DD)

   bill_ids(대표 5건)만 보여주던 것을 전건으로 바꿨다 — SNS 카드(훅)를 보고 들어온 사람이
   "그날 무슨 법안들이 나왔나" 를 여기서 전부 볼 수 있어야 한다 (사용자 요청 2026-10-15).

   ⚠️ 정렬은 **bill_no(접수 순)** 다. 공동발의 많은 순 같은 값 기준 정렬을 기본으로 두면
      그 자체가 "이 법안이 더 중요하다" 는 편집이 된다 — 기본은 사실 순서, 크기 비교는 숫자가 한다.
   ⚠️ summary 는 LEFT 로 자른다 — 전문은 상세가 보는 자리고, 하루 최대 51건 × 10KB 를 다 실으면
      페이로드가 수백 KB 가 된다 (법안 목록 getList.sql 과 같은 판단).
   ⚠️ politicians 는 LEFT JOIN — 퇴임 의원·위원장 제안은 조인이 비는데 그래도 행은 나와야 한다.
      그 경우 photo_url 이 NULL 이라 뷰가 이니셜 아바타로 폴백한다 (proposer_name 은 bills 가 든다). */
SELECT b.bill_id
     , b.bill_name
     , b.proposer_name
     , b.co_proposer_count
     , b.committee
     , b.mona_cd
     , p.party_name
     , p.photo_url
     , LEFT(b.summary, 400) AS summary
  FROM bills b
  LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
 WHERE b.propose_dt = $1
 ORDER BY b.bill_no ASC, b.bill_id ASC
