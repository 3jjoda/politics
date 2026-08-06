/* 게시글 상세 ($1: id) */
SELECT p.id
     , p.title
     , p.content
     , p.user_id
     , p.linked_bill_id
     , p.view_count
     , p.is_deleted
     , TO_CHAR(p.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     , TO_CHAR(p.updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
     , u.nickname
     , u.provider
     , b.bill_name        AS linked_bill_name
     , b.bill_no          AS linked_bill_no
     , b.proc_result_name AS linked_bill_result
     , b.committee        AS linked_bill_committee
     , TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS linked_bill_propose_dt
  FROM posts p
  LEFT JOIN users u ON u.user_id = p.user_id
  LEFT JOIN bills b ON b.bill_id = p.linked_bill_id
 WHERE p.id = $1
