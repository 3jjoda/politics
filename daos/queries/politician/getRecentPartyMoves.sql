/* 홈 - 최근 정당 이동 내역 (politician_party_memberships 기반, LAG 로 이전 정당 연결) */
WITH history AS (
    SELECT m.mona_cd
         , m.party_id
         , m.start_date
         , LAG(m.party_id) OVER (PARTITION BY m.mona_cd ORDER BY m.start_date, m.membership_id) AS prev_party_id
      FROM politician_party_memberships m
)
SELECT h.mona_cd
     , pol.name
     , pol.photo_url
     , pol.electoral_district
     , pol.active_yn
     , pf.party_name AS from_party
     , pt.party_name AS to_party
     , h.start_date  AS moved_at
  FROM history h
  JOIN politicians pol ON pol.mona_cd  = h.mona_cd
  JOIN parties     pt  ON pt.party_id  = h.party_id
  JOIN parties     pf  ON pf.party_id  = h.prev_party_id
 WHERE h.prev_party_id IS NOT NULL
   AND h.prev_party_id <> h.party_id
 ORDER BY h.start_date DESC, pol.name
 LIMIT $1
