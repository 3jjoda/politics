/* 유형별 글 수 — 목록 탭 숫자용 (삭제 제외) */
SELECT post_type, COUNT(*)::int AS cnt
  FROM posts
 WHERE is_deleted = FALSE
 GROUP BY post_type
