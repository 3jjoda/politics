/* 게시글 목록 (페이징 + 유형 필터)
   $1 limit, $2 offset, $3 post_type (NULL 이면 전체)
   댓글 수/좋아요 수는 서브쿼리로 집계.
   🔴 고정 공지(is_pinned)는 전체 탭에서 맨 위 — 유형 탭에서는 그 유형 안에서만 (WHERE 가 이미 거른다).
      is_pinned DESC 를 첫 정렬 키로 두는 것으로 둘 다 성립한다 */
SELECT p.id
     , p.title
     , p.user_id
     , p.post_type
     , p.is_pinned
     , p.linked_bill_id
     , p.view_count
     , TO_CHAR(p.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     , u.nickname
     , u.provider
     , b.bill_name       AS linked_bill_name
     , b.proc_result_name AS linked_bill_result
     , (SELECT COUNT(*) FROM comments c
         WHERE c.type = 'post'
           AND c.target_id::text = p.id::text
           AND c.is_deleted = FALSE) AS comment_count
     , (SELECT COUNT(*) FROM likes l
         WHERE l.type = 'post'
           AND l.target_id::text = p.id::text)   AS like_count
     , COUNT(*) OVER() AS total_count
  FROM posts p
  LEFT JOIN users u ON u.user_id = p.user_id
  LEFT JOIN bills b ON b.bill_id = p.linked_bill_id
 WHERE p.is_deleted = FALSE
   AND ($3::varchar IS NULL OR p.post_type = $3)
 ORDER BY p.is_pinned DESC, p.id DESC
 LIMIT $1 OFFSET $2
