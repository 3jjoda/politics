/* 이 법안을 다룬 커뮤니티 글 (법안 상세의 역링크)
   $1 bill_id, $2 limit

   🔴 링크가 한 방향뿐이었다 — 글은 법안을 첨부할 수 있는데(`posts.linked_bill_id`)
      법안 쪽에서 그 글을 볼 방법이 없었다. 이미 있는 데이터를 살리는 쿼리다.
   ⚠️ comments.target_id 는 VARCHAR 라 `::text` 로 맞춘다 (likes 는 INTEGER — 섞지 말 것). */
SELECT p.id
     , p.title
     , p.post_type
     , TO_CHAR(p.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     , u.nickname
     , u.provider
     , (SELECT COUNT(*) FROM comments c
         WHERE c.type = 'post'
           AND c.target_id::text = p.id::text
           AND c.is_deleted = FALSE)::int AS comment_count
  FROM posts p
  LEFT JOIN users u ON u.user_id = p.user_id
 WHERE p.is_deleted = FALSE
   AND p.linked_bill_id = $1
 ORDER BY p.id DESC
 LIMIT $2
