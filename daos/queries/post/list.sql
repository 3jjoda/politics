/* 게시글 목록 (페이징)
   $1 limit, $2 offset
   댓글 수/좋아요 수는 서브쿼리로 집계
*/
SELECT p.id
     , p.title
     , p.user_id
     , p.linked_bill_id
     , p.view_count
     , TO_CHAR(p.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS created_at
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
 ORDER BY p.id DESC
 LIMIT $1 OFFSET $2
