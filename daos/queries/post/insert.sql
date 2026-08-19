/* 게시글 작성
   $1 user_id, $2 title, $3 content, $4 linked_bill_id (nullable), $5 post_type, $6 is_pinned
   ⚠️ post_type 의 권한(공지=관리자만)은 서버(PostController)가 검증한 뒤 넘긴다 */
INSERT INTO posts (user_id, title, content, linked_bill_id, post_type, is_pinned)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
