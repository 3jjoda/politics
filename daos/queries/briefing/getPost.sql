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
     , bp.hook
     , COALESCE(
         (SELECT json_object_agg(b.bill_id,
                   json_build_object('bill_name', b.bill_name, 'proposer_name', b.proposer_name, 'mona_cd', b.mona_cd,
                     /* 카드 표지(A형)의 "사람" 재료 — 퇴임 의원은 조인이 비어 photo 가 NULL 이고,
                        그러면 컨트롤러가 사람 없는 B형 표지로 접는다 (데이터가 분기를 정한다) */
                     'photo_url', p.photo_url, 'district', p.electoral_district))
            FROM bills b
            LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
           WHERE b.bill_id IN (
                 SELECT jsonb_array_elements_text(t->'bill_ids')
                   FROM jsonb_array_elements(bp.threads) t
                 /* ⚠️ hook 의 법안도 포함 — 훅이 1건짜리 흐름을 고르면 그 흐름은 threads 저장에서
                    걸러져(2건 미만) 여기 없고, 그러면 표지가 사람을 못 찾아 B형으로 떨어진다 (실측 2026-10-15) */
                 UNION
                 SELECT jsonb_array_elements_text(bp.hook->'bill_ids'))),
         '{}'::json
       ) AS thread_bills
  FROM briefing_posts bp
 WHERE bp.id = $1
