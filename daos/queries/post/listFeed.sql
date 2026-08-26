/* 커뮤니티 통합 피드 — **글과 댓글이 한 줄기로 흐른다** (2026-08-27, 4단계)
   $1 필터 ('all' | 'bill' | 'politician' | 'briefing' | 'posts'), $2 글 유형(NULL=전체), $3 limit, $4 offset

   🔴 왜 합치나: 3단계까지는 글 목록과 「최근 대화」가 **탭으로 갈라져** 있었다. 그러면 댓글은
      여전히 탭 하나 뒤에 숨고, 커뮤니티 첫 화면은 계속 "대상 없는 글" 만 보여준다 —
      고치려던 바로 그 구조가 남는다. 첫 화면이 곧 통합 피드여야 한다.

   ⚠️ 이 쿼리는 posts·comments 를 **둘 다** 읽는다. queries/post 에 둔 건 커뮤니티 페이지를
      PostController 가 그리기 때문이지 posts 만의 것이라서가 아니다.
   ⚠️ 대상이 사라진 댓글은 뺀다 (comment/listRecent.sql 과 같은 규칙).
   ⚠️ 정렬은 **시간순뿐**이다. 인기순·추천순을 넣지 말 것 — 어느 대화를 띄울지가 곧 편집이고,
      정치 사이트에서 그건 진영 판정이 된다.
   ⚠️ `COUNT(*) OVER()` 는 조건에 맞는 행을 전부 훑는다. 수만 건이 되면 커서 페이징으로 바꿀 것 */
WITH feed AS (
    /* 커뮤니티 글 */
    SELECT 'post'::varchar(10)      AS kind
         , p.id                     AS id
         , p.created_at             AS created_at
         , p.user_id                AS user_id
         , p.title                  AS text
         , p.post_type              AS post_type
         , p.is_pinned              AS is_pinned
         , p.linked_bill_id         AS linked_bill_id
         , NULL::varchar(20)        AS ctx_kind
         , NULL::varchar(50)        AS ctx_id
      FROM posts p
     WHERE p.is_deleted = FALSE
       AND $1 IN ('all', 'posts')
       AND ($2::varchar IS NULL OR p.post_type = $2)

    UNION ALL

    /* 법안·의원·브리핑·글에 달린 댓글 */
    SELECT 'comment'
         , c.id
         , c.created_at
         , c.user_id
         , LEFT(c.content, 200)
         , NULL
         , FALSE
         , NULL
         , c.type
         , c.target_id
      FROM comments c
     WHERE c.is_deleted = FALSE
       /* 글 유형 필터는 글 전용이다 — 걸려 있으면 댓글은 통째로 빠진다 */
       AND $2::varchar IS NULL
       /* 🔴 `posts` 는 **커뮤니티 글만**이다. 글에 달린 댓글을 여기 넣으면 탭 숫자(글 3)와
          실제 행 수(4)가 어긋나고, 둘째 줄의 글 유형 탭도 댓글엔 걸 수 없어 뜻이 무너진다.
          글 댓글은 `all` 에서 보이고, 그 글을 열면 원래 자리에서 보인다 */
       AND ($1 = 'all' OR $1 = c.type)
       AND CASE c.type
             WHEN 'bill'       THEN EXISTS (SELECT 1 FROM bills b WHERE b.bill_id = c.target_id)
             WHEN 'politician' THEN EXISTS (SELECT 1 FROM politicians pl WHERE pl.mona_cd = c.target_id)
             WHEN 'briefing'   THEN EXISTS (SELECT 1 FROM briefing_posts bp WHERE bp.id::text = c.target_id)
             WHEN 'post'       THEN EXISTS (SELECT 1 FROM posts po
                                             WHERE po.id::text = c.target_id AND po.is_deleted = FALSE)
             ELSE FALSE
           END
)
SELECT f.kind
     , f.id
     , f.text
     , f.post_type
     , f.is_pinned
     , f.ctx_kind
     , f.ctx_id
     , TO_CHAR(f.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     , u.nickname
     , u.provider
     /* 글 전용 — 조회수·댓글수·첨부 법안 */
     , pp.view_count
     , CASE WHEN f.kind = 'post' THEN
         (SELECT COUNT(*) FROM comments c2
           WHERE c2.type = 'post' AND c2.target_id::text = f.id::text AND c2.is_deleted = FALSE)
       END::int AS comment_count
     , lb.bill_name        AS linked_bill_name
     , lb.proc_result_name AS linked_bill_result
     /* 댓글 전용 — 어느 대상에 달렸나 */
     , CASE f.ctx_kind
         WHEN 'bill'       THEN (SELECT b.bill_name FROM bills b WHERE b.bill_id = f.ctx_id)
         WHEN 'politician' THEN (SELECT pl.name FROM politicians pl WHERE pl.mona_cd = f.ctx_id)
         WHEN 'briefing'   THEN (SELECT TO_CHAR(bp.briefing_date, 'MM.DD') || ' 브리핑'
                                   FROM briefing_posts bp WHERE bp.id::text = f.ctx_id)
         WHEN 'post'       THEN (SELECT po.title FROM posts po WHERE po.id::text = f.ctx_id)
       END AS ctx_label
     , COUNT(*) OVER() AS total_count
  FROM feed f
  LEFT JOIN users u  ON u.user_id = f.user_id
  LEFT JOIN posts pp ON f.kind = 'post' AND pp.id = f.id
  LEFT JOIN bills lb ON lb.bill_id = f.linked_bill_id
 /* 🔴 고정 공지는 어느 필터에서도 맨 위. 그 밖은 시간순 */
 ORDER BY f.is_pinned DESC, f.created_at DESC, f.kind, f.id DESC
 LIMIT $3 OFFSET $4
