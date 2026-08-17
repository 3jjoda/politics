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
     , bp.threads
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
     /* threads 가 지목한 법안들 — bill_id 로 찾아쓰는 조회용 맵.
        상세에서는 "이 주제에 묶인 법안이 실제로 무엇인지" 를 펼쳐 보여줘야 검증이 가능하다
        (묶음이 맞는지 독자가 직접 확인할 수 있어야 AI 결과물을 신뢰할 근거가 생긴다).
        대표 법안 5건과 겹칠 수 있으나 별도로 받는다 — threads 는 그 5건 밖도 지목한다. */
     , COALESCE(
         (SELECT json_object_agg(b.bill_id,
                   json_build_object('bill_name', b.bill_name, 'proposer_name', b.proposer_name, 'mona_cd', b.mona_cd))
            FROM bills b
           WHERE b.bill_id IN (
                 SELECT jsonb_array_elements_text(t->'bill_ids')
                   FROM jsonb_array_elements(bp.threads) t)),
         '{}'::json
       ) AS thread_bills
  FROM briefing_posts bp
 WHERE bp.id = $1
