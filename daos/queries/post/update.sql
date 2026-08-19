/* 게시글 수정 (본인만)
   $1 title, $2 content, $3 linked_bill_id, $4 post_type, $5 is_pinned, $6 id, $7 user_id */
UPDATE posts
   SET title          = $1,
       content        = $2,
       linked_bill_id = $3,
       post_type      = $4,
       is_pinned      = $5
 WHERE id = $6 AND user_id = $7 AND is_deleted = FALSE
RETURNING id
