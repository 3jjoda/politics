/* 브리핑 본체 — 최근 N일 발의 법안을 **위원회별로 묶어서**
   $1: window_days (int)

   ⚠️ 여기서 자르지 않는다. **창 안의 전체**를 돌려주고 몇 건을 접을지는 뷰가 정한다.
      "전체 보기" 토글이 서버 왕복 없이 동작해야 하기 때문 (실측 98건 = 페이로드 부담 없음).
      대신 summary 는 짧게 잘라 온다 — 미리보기는 130자만 쓴다.

   왜 묶는가: 브리핑은 "이번 주 국회가 무엇을 다뤘나" 에 답해야 한다.
   법안을 평평하게 나열하면 /bill?sort=recent 와 다를 게 없다.
   위원회로 묶으면 그 주의 관심사가 드러난다 (세제에 몰렸다, 국토에 몰렸다).

   그룹 안 정렬은 공동발의 수 — 1단계(AI 없음)에서 쓸 수 있는 유일한 관심도 프록시.
   ⚠️ 정렬·그룹 순서에 정당을 넣지 말 것. 위원회와 건수만으로 정한다.

   committee 가 NULL 인 건 "미지정" 이 아니라 **아직 회부 전**이다.
   같은 그룹으로 묶되 라벨을 그렇게 달아야 결손처럼 안 보인다. */
WITH win AS (
    SELECT b.*
         , COALESCE(NULLIF(b.committee, ''), '__PENDING__') AS grp
      FROM bills b
     WHERE b.propose_dt > CURRENT_DATE - $1::int
), ranked AS (
    SELECT w.bill_id
         , w.bill_no
         , w.bill_name
         , w.proposer_name
         , w.mona_cd
         , w.co_proposer_count
         , w.grp
         , TO_CHAR(w.propose_dt, 'YYYY-MM-DD')  AS propose_dt
           -- 카드가 2줄 클램프라 화면에 들어가는 건 90자 남짓이다. 그 이상은 전송 낭비 —
           -- 창 안 전체(98건)를 내려보내는 구조라 건당 몇 십 바이트가 곧바로 페이로드가 된다.
         , LEFT(w.summary, 150)                 AS summary
         , p.photo_url                          AS proposer_photo
         , p.party_name                         AS proposer_party
         , (a.bill_id IS NOT NULL)              AS has_ai_analysis
         , COUNT(*) OVER (PARTITION BY w.grp)   AS grp_total
         , ROW_NUMBER() OVER (
               PARTITION BY w.grp
               ORDER BY w.co_proposer_count DESC NULLS LAST, w.propose_dt DESC, w.bill_id DESC
           ) AS rn
      FROM win w
      LEFT JOIN politicians p       ON p.mona_cd = w.mona_cd
      LEFT JOIN bill_ai_analysis a  ON a.bill_id = w.bill_id
)
SELECT *
  FROM ranked
 ORDER BY grp_total DESC, grp, rn
