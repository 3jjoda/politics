/* 인스타 카드 "같은 법률에 몰린 개정안" 장 — 법률별 대표발의자
   $1: 카드 날짜 (YYYY-MM-DD)   $2: 법안명 배열 (stats.hotLaws 의 bill_name)

   stats.hotLaws 는 `bill_name + cnt` 뿐이라 "2건" 만 세 번 반복돼 밋밋했다.
   이 장의 이야기는 **같은 법을 두고 서로 다른 의원이 각자 안을 냈다**는 것이라 누가 냈는지가 있어야 한다.
   stats(고정 스냅샷)를 소스로 두고 이름만 붙인다 — 건수는 stats 값을 그대로 쓴다.
   ⚠️ 정당은 안 붙인다 (카드에 정당명이 늘어서면 대비 구도가 된다 — 흐름 장과 같은 규칙) */
SELECT b.bill_name
     , array_agg(b.proposer_name ORDER BY b.bill_id) FILTER (WHERE b.proposer_name IS NOT NULL) AS proposers
  FROM bills b
 WHERE b.propose_dt = $1::date
   AND b.bill_name = ANY($2::text[])
 GROUP BY b.bill_name
