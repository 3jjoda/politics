/* 최근 대화 — 법안·의원·브리핑·글에 달린 댓글을 한 줄기로 (`/community?tab=talk`)
   $1 limit, $2 offset

   🔴 왜 필요한가: 댓글 네 종류가 `comments` 한 테이블에 다 들어가는데 **모아 보는 화면이 없었다.**
      법안 댓글이 18,741곳에 흩어져 있어 달아도 아무도 못 봤고, 그래서 사람들이 목록이 있는
      자유게시판으로 몰렸다 — "기록 옆의 대화"를 죽이고 "맥락 없는 잡담"을 살리는 구조였다.

   🔴 정렬은 **시간순(id DESC)뿐이다. 인기순·추천순을 넣지 말 것** —
      어느 대화를 띄울지가 곧 편집이고, 정치 사이트에서 그건 진영 판정이 된다.

   ⚠️ 대상이 사라진 댓글(삭제된 글 등)은 뺀다. 안 빼면 이름 없는 줄이 남는다.
   ⚠️ `comments.target_id` 는 VARCHAR 다. briefing·post 는 숫자 PK 라 **`id::text` 로 캐스팅** —
      반대 방향(target_id::bigint)은 쓰레기 값이 들어오면 통째로 터진다.
      (`likes.target_id` 는 INTEGER 라 규칙이 다르다 — 섞지 말 것)
   ⚠️ `COUNT(*) OVER()` 는 조건에 맞는 행을 전부 훑는다 (post/list.sql 과 같은 패턴).
      댓글이 수만 건이 되면 total 을 따로 세거나 커서 페이징으로 바꿀 것 */
SELECT c.id
     , c.type
     , c.target_id
     , LEFT(c.content, 200) AS content
     , TO_CHAR(c.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     , u.nickname
     , u.provider
     , CASE c.type
         WHEN 'bill'       THEN (SELECT b.bill_name FROM bills b WHERE b.bill_id = c.target_id)
         WHEN 'politician' THEN (SELECT p.name      FROM politicians p WHERE p.mona_cd = c.target_id)
         WHEN 'briefing'   THEN (SELECT TO_CHAR(bp.briefing_date, 'MM.DD') || ' 브리핑'
                                   FROM briefing_posts bp WHERE bp.id::text = c.target_id)
         WHEN 'post'       THEN (SELECT po.title FROM posts po
                                  WHERE po.id::text = c.target_id AND po.is_deleted = FALSE)
       END AS target_label
     , COUNT(*) OVER() AS total_count
  FROM comments c
  LEFT JOIN users u ON u.user_id = c.user_id
 WHERE c.is_deleted = FALSE
   AND CASE c.type
         WHEN 'bill'       THEN EXISTS (SELECT 1 FROM bills b WHERE b.bill_id = c.target_id)
         WHEN 'politician' THEN EXISTS (SELECT 1 FROM politicians p WHERE p.mona_cd = c.target_id)
         WHEN 'briefing'   THEN EXISTS (SELECT 1 FROM briefing_posts bp WHERE bp.id::text = c.target_id)
         WHEN 'post'       THEN EXISTS (SELECT 1 FROM posts po
                                         WHERE po.id::text = c.target_id AND po.is_deleted = FALSE)
         ELSE FALSE
       END
 ORDER BY c.id DESC
 LIMIT $1 OFFSET $2
