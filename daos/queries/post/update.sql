/* 게시글 수정 (본인만)
   $1 title, $2 content, $3 linked_bill_id, $4 id, $5 user_id
*/
UPDATE posts
   SET title          = $1,
       content        = $2,
       linked_bill_id = $3
 WHERE id = $4 AND user_id = $5 AND is_deleted = FALSE
RETURNING id
