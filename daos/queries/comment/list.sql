/* 특정 대상의 댓글 목록 (작성자 정보 조인)
   $1 type, $2 target_id
*/
SELECT c.id
     , c.type
     , c.target_id
     , c.parent_id
     , c.user_id
     , c.content
     , c.is_deleted
     , TO_CHAR(c.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS created_at
     , TO_CHAR(c.updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS updated_at
     , u.nickname
     , u.provider
  FROM comments c
  LEFT JOIN users u ON u.user_id = c.user_id
 WHERE c.type = $1
   AND c.target_id = $2
 ORDER BY c.parent_id NULLS FIRST, c.created_at ASC
