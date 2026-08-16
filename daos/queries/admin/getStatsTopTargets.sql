/* 관리자 방문 통계 — 최근 N일 상세 페이지 TOP (의원·법안·브리핑). 이름은 각 테이블에서 조인.
   ⚠️ 관리자만 본다 — 조회 순위를 공개하면 그 자체가 편집이 된다.
   $1 = 일수, $2 = page_kind, $3 = 상한 */
SELECT v.target_id
     , SUM(v.views)::int   AS views
     , SUM(v.uniques)::int AS uniques
     , CASE $2
         WHEN 'politician_detail' THEN (SELECT p.name || ' · ' || COALESCE(p.party_name, '') FROM politicians p WHERE p.mona_cd = v.target_id)
         WHEN 'bill_detail'       THEN (SELECT b.bill_name FROM bills b WHERE b.bill_id = v.target_id)
         WHEN 'briefing_detail'   THEN (SELECT TO_CHAR(bp.briefing_date, 'YYYY-MM-DD') || ' · ' || COALESCE(bp.headline, '') FROM briefing_posts bp WHERE bp.id::text = v.target_id)
       END AS label
  FROM page_views_daily v
 WHERE v.page_kind = $2 AND v.view_date >= CURRENT_DATE - ($1::int - 1)
 GROUP BY v.target_id
 ORDER BY views DESC, uniques DESC
 LIMIT $3::int;
