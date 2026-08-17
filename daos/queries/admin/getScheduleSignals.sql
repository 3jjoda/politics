/* 운영 일정 — 각 정기 작업의 "마지막으로 한 때" 신호 (관리자 /admin/schedule, 2026-08-16)
   전부 이미 있는 테이블에서 읽는다. 일정 테이블을 따로 만들지 않는다 — 기록은 각 작업이 스스로 남긴다 */
SELECT
  (SELECT TO_CHAR(MAX(updated_at), 'YYYY-MM-DD') FROM bill_axis_mapping WHERE mapping_version = 'v2')          AS mapping_last,
  (SELECT COUNT(*)::int FROM bill_axis_mapping WHERE mapping_version = 'v2')                                     AS mapping_n,
  (SELECT TO_CHAR(MAX(computed_at), 'YYYY-MM-DD HH24:MI') FROM politician_axis_score WHERE mapping_version = 'v2') AS axis_last,
  (SELECT COUNT(*)::int FROM politician_axis_score WHERE mapping_version = 'v2' AND economy IS NOT NULL AND social IS NOT NULL AND institution IS NOT NULL) AS axis_n3,
  (SELECT COUNT(*)::int FROM user_axis_score WHERE mapping_version = 'v1' AND ',' || COALESCE(packs_completed,'') || ',' LIKE '%,general,%') AS users_done,
  (SELECT COUNT(*)::int FROM bills WHERE propose_dt > COALESCE((SELECT MAX(updated_at) FROM bill_axis_mapping WHERE mapping_version='v2'), '1900-01-01')::date) AS bills_since_mapping,
  (SELECT COUNT(*)::int FROM politician_titles WHERE review_after IS NOT NULL AND review_after <= CURRENT_DATE)  AS titles_due,
  (SELECT COUNT(*)::int FROM politician_titles WHERE review_after > CURRENT_DATE AND review_after <= CURRENT_DATE + 30) AS titles_soon,
  (SELECT TO_CHAR(MIN(review_after), 'YYYY-MM-DD') FROM politician_titles WHERE review_after > CURRENT_DATE)      AS titles_next,
  (SELECT briefing_date::text FROM briefing_posts ORDER BY briefing_date DESC LIMIT 1)                            AS briefing_last
