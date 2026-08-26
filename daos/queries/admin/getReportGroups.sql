/* 신고 목록 — 🔴 **대상 단위로 묶는다** (신고 단위가 아니다)
   $1 필터 ('open' | 'handled' | 'all'), $2 limit

   관리자가 판단하는 것은 "이 댓글을 지울까" 이지 "이 신고를 처리할까" 가 아니다.
   같은 댓글에 신고가 3건이면 한 화면에 한 줄로 뜨고 한 번의 판단으로 3건이 같이 닫힌다.

   ⚠️ 필터를 WHERE 가 아니라 **HAVING** 으로 건다. WHERE 로 걸면 그룹 안에 그 상태의 행만 남아
      건수가 대상 전체를 못 나타내고, 「살려둠 2건 + 새 신고 1건」 인 대상이 양쪽 목록에 다르게 보인다.
   ⚠️ 대상이 사라진 신고도 남긴다 (`target_text` NULL) — 숨기면 왜 목록 수가 안 맞는지 알 수 없다. */
SELECT r.type
     , r.target_id
     , COUNT(*)::int                                  AS report_count
     , COUNT(DISTINCT r.user_id)::int                 AS reporter_count
     , COUNT(*) FILTER (WHERE r.status = 'open')::int AS open_count
     /* 그룹의 실효 상태 — 하나라도 미처리면 미처리, 아니면 가장 최근 처리 결과 */
     , CASE WHEN COUNT(*) FILTER (WHERE r.status = 'open') > 0 THEN 'open'
            ELSE (array_agg(r.status ORDER BY r.handled_at DESC NULLS LAST))[1] END AS status
     , array_agg(DISTINCT r.reason)                   AS reasons
     , TO_CHAR(MAX(r.created_at), 'YYYY-MM-DD HH24:MI') AS last_reported_at
     , TO_CHAR(MAX(r.handled_at), 'YYYY-MM-DD HH24:MI') AS handled_at
     , (array_agg(hu.nickname ORDER BY r.handled_at DESC NULLS LAST))[1] AS handled_by_nick
     /* 대상 — 댓글이면 본문, 글이면 제목 */
     , LEFT(COALESCE(c.content, p.title), 300)        AS target_text
     , COALESCE(c.is_deleted, p.is_deleted)           AS target_deleted
     , au.nickname                                    AS author_nick
     /* 원래 자리로 가는 재료: 댓글은 그 댓글이 달린 곳(bill|politician|briefing|post)과 그 id */
     , c.type      AS comment_kind
     , c.target_id AS comment_target
  FROM reports r
  LEFT JOIN comments c ON r.type = 'comment' AND c.id = r.target_id
  LEFT JOIN posts    p ON r.type = 'post'    AND p.id = r.target_id
  LEFT JOIN users   au ON au.user_id = COALESCE(c.user_id, p.user_id)
  LEFT JOIN users   hu ON hu.user_id = r.handled_by
 GROUP BY r.type, r.target_id, c.content, c.is_deleted, c.type, c.target_id,
          p.title, p.is_deleted, au.nickname
HAVING $1 = 'all'
    OR ($1 = 'open'    AND COUNT(*) FILTER (WHERE r.status = 'open') > 0)
    OR ($1 = 'handled' AND COUNT(*) FILTER (WHERE r.status = 'open') = 0)
 ORDER BY (COUNT(*) FILTER (WHERE r.status = 'open') > 0) DESC, MAX(r.created_at) DESC
 LIMIT $2
