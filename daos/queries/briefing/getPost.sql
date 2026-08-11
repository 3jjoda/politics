/* 브리핑 카드 단건 — 상세(댓글·공유 대상)
   $1: id (bigint)

   `bill_ids` 에 담긴 대표 법안을 JOIN 으로 붙여 온다.
   jsonb 배열 → text[] 로 풀어서 ANY 매칭 (정렬은 원래 순서를 지키려고 ordinality 사용). */
SELECT bp.id
     , TO_CHAR(bp.briefing_date, 'YYYY-MM-DD') AS briefing_date
     , bp.headline
     , bp.body
     , bp.keywords
     , bp.stats
     , bp.model
     , bp.prompt_version
     , COALESCE(
         (SELECT json_agg(x ORDER BY x.ord)
            FROM (
              SELECT e.ord
                   , b.bill_id
                   , b.bill_name
                   , b.proposer_name
                   , b.co_proposer_count
                   , b.committee
                   , p.party_name
                   , p.photo_url
                   , LEFT(b.summary, 260) AS summary
                FROM jsonb_array_elements_text(bp.bill_ids) WITH ORDINALITY AS e(bill_id, ord)
                JOIN bills b ON b.bill_id = e.bill_id
                LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
            ) x),
         '[]'::json
       ) AS bills
  FROM briefing_posts bp
 WHERE bp.id = $1
