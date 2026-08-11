/* 관리자 — 등록된 직위 전체 (사람 정보 조인)
   review_after 상태를 화면에서 색으로 구분하려고 서버에서 판정해 내려준다.
   ⚠️ updated_at 은 politicians 에도 있으므로 반드시 별칭으로 한정할 것 (조인 시 ambiguous) */
SELECT t.id
     , t.mona_cd
     , t.category
     , t.title
     , t.source_url
     , t.note
     , TO_CHAR(t.review_after, 'YYYY-MM-DD') AS review_after
     , TO_CHAR(t.updated_at, 'YYYY-MM-DD')   AS updated_at
     , p.name
     , p.party_name
     , p.photo_url
       /* 지남 / 임박(30일) / 여유 — review_after 없으면 updated_at + 6개월로 폴백 (배치 점검과 같은 규칙) */
     , CASE
         WHEN COALESCE(t.review_after, (t.updated_at + INTERVAL '6 months')::date) <= CURRENT_DATE THEN 'due'
         WHEN t.review_after IS NOT NULL AND t.review_after <= CURRENT_DATE + 30                   THEN 'soon'
         ELSE 'ok'
       END AS review_state
  FROM politician_titles t
  LEFT JOIN politicians p ON p.mona_cd = t.mona_cd
 ORDER BY CASE t.category
            WHEN '의장단'   THEN 0
            WHEN '국무위원' THEN 1
            WHEN '교섭단체' THEN 2
            ELSE 3
          END
        , t.title
        , p.name
