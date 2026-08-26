/* 신고 접수 — 1인 1대상 1건 (UNIQUE type,target_id,user_id)
   $1 type, $2 target_id, $3 user_id, $4 reason

   ⚠️ 이미 신고한 대상이면 **에러가 아니라 사유만 갱신**한다. 두 번 눌렀다고 400 을 주면
      "내가 신고했었나" 를 기억해야 하는 부담이 사용자에게 간다.
   ⚠️ 다시 신고하면 status 를 open 으로 되돌린다 — 처리 뒤에 또 신고가 들어왔다는 신호다. */
INSERT INTO reports (type, target_id, user_id, reason)
VALUES ($1, $2, $3, $4)
ON CONFLICT (type, target_id, user_id)
DO UPDATE SET reason = EXCLUDED.reason, status = 'open', handled_at = NULL, handled_by = NULL
RETURNING id
