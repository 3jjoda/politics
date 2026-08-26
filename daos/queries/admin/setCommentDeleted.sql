/* 관리자 삭제·복구 — $1 id, $2 is_deleted
   🔴 본인 확인(user_id)이 없다. 그래서 **관리자 전용 쿼리다** (일반 경로는 comment/softDelete.sql). */
UPDATE comments SET is_deleted = $2 WHERE id = $1 RETURNING id
