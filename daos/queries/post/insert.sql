/* 게시글 작성
   $1 user_id, $2 title, $3 content, $4 linked_bill_id (nullable)
*/
INSERT INTO posts (user_id, title, content, linked_bill_id)
VALUES ($1, $2, $3, $4)
RETURNING id
