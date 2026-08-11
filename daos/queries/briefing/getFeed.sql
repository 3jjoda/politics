/* 브리핑 피드 — AI 카드 목록 (최신순)
   $1: limit (int)
   $2: offset (int)

   댓글·좋아요 수는 LEFT JOIN 집계 (type='briefing', target_id = 카드 id).
   기존 인프라를 CHECK 확장만으로 재사용한다.

   ⚠️ **두 테이블의 target_id 타입이 다르다** (실측):
        comments.target_id  VARCHAR  → bp.id::text 로 비교
        likes.target_id     INTEGER  → bp.id 그대로 비교 (::text 하면 integer = text 에러)
      CLAUDE.md 에는 likes.target_id 가 VARCHAR(50) 으로 적혀 있었지만 실제 스키마는 INTEGER 다. */
SELECT bp.id
     , TO_CHAR(bp.briefing_date, 'YYYY-MM-DD') AS briefing_date
     , bp.headline
     , bp.body
     , bp.keywords
     , bp.stats
     , bp.bill_ids
     , bp.threads
     , bp.model
     , COALESCE(c.cnt, 0)::int AS comment_count
     , COALESCE(l.cnt, 0)::int AS like_count
  FROM briefing_posts bp
  LEFT JOIN (
      SELECT target_id, COUNT(*)::int AS cnt
        FROM comments WHERE type = 'briefing' AND is_deleted = FALSE
       GROUP BY target_id
  ) c ON c.target_id = bp.id::text
  LEFT JOIN (
      SELECT target_id, COUNT(*)::int AS cnt
        FROM likes WHERE type = 'briefing'
       GROUP BY target_id
  ) l ON l.target_id = bp.id
 ORDER BY bp.briefing_date DESC
 LIMIT $1 OFFSET $2
