/* 대상의 **모든** 신고를 한 상태로 — $1 type, $2 target_id, $3 status, $4 handled_by
   ⚠️ open 만 갱신하지 않는다. status 는 사실상 「대상의 상태」를 각 행에 복제해 둔 것이라,
      나중에 판단을 바꾸면 그 대상의 과거 신고까지 같이 따라가야 앞뒤가 맞는다. */
UPDATE reports
   SET status = $3, handled_at = NOW(), handled_by = $4
 WHERE type = $1 AND target_id = $2
RETURNING id
