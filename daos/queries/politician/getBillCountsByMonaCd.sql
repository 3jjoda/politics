/* 정치인 상세 - 법안 활동 탭의 **개수만**.
   🔴 탭 라벨(전체/대표발의/공동발의)에 숫자를 바로 띄우려면 개수가 필요한데,
      그것 때문에 887행을 통째로 들고 올 이유는 없다. 개수만 센다.
   ⚠️ 조건은 getBillsPageByMonaCd.sql 과 **같아야** 한다 — 어긋나면 "전체 887" 이라 써놓고
      페이지를 넘기면 다른 수가 나온다. */
SELECT COUNT(*)::int AS total
     , COUNT(*) FILTER (WHERE b.mona_cd = $1)::int AS rep
     , COUNT(*) FILTER (WHERE b.mona_cd IS DISTINCT FROM $1)::int AS co
  FROM bills b
 WHERE b.mona_cd = $1
    OR b.bill_id IN (SELECT bill_id FROM bill_co_proposers WHERE mona_cd = $1)
