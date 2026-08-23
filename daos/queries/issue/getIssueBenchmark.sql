-- 이 쟁점이 국회에서 **실제로 굴러가고 있나** — 전체 기준선과 비교할 지표 3종
--
-- 🔴 이 페이지의 킥이다 (2026-08-23). 그 전까지 요약 숫자가 전부 **총량**(165건·282명·17법률)이라
--    "그래서 많은 건가 적은 건가" 에 답하지 못했다. 총량은 놀랍지 않다.
--    **기준선과 나란히 놓는 순간 사실이 된다** — 실측:
--      촉법소년  위원회 처리 0%(전체 26.2%) · 두 거대정당 공동서명 0% · 계류 532일(전체 411일)
--      전세사기  위원회 처리 39.2% · 공동서명 4.9% · 계류 463일 · 실제 1건 통과
--    같은 "쟁점" 인데 하나는 아무것도 안 굴러가고 하나는 굴러갔다. 그 대비가 정보다.
--
-- ⚠️ **좋다/나쁘다를 말하지 않는다.** 위원회 처리율이 낮은 게 게으름이라는 뜻이 아니고
--    (발의가 많을수록 분모가 커져 낮아진다), 공동서명이 많다고 합의가 됐다는 뜻도 아니다.
--    화면이 각주로 밝힌다.
-- ⚠️ `여야` 대신 **`두 거대 정당`** 으로 쓴다 — 의석 대부분이지만 국회가 두 당뿐인 건 아니다.
-- 🔴 아래 WHERE 의 자리표시자는 IssueDao 가 조립한다 (getIssueBills.sql 과 같은 규칙).
WITH scope AS (
    SELECT b.bill_id, b.cmt_proc_dt, b.propose_dt, b.proc_result_name
      FROM bills b
     WHERE __MATCH__
), cross_party AS (
    -- 민주·국힘이 **같이** 이름을 올린 법안. 무소속만 껴도 성립하는 "2개 정당 이상" 은 초당성 지표가 못 된다
    SELECT s.bill_id
      FROM scope s
      JOIN bill_co_proposers c ON c.bill_id = s.bill_id
      JOIN politicians p       ON p.mona_cd = c.mona_cd
     GROUP BY s.bill_id
    HAVING COUNT(*) FILTER (WHERE p.party_name = '더불어민주당') > 0
       AND COUNT(*) FILTER (WHERE p.party_name = '국민의힘')     > 0
), signed AS (
    -- 공동발의자가 하나라도 있는 법안 (공동서명 비율의 분모)
    SELECT DISTINCT s.bill_id FROM scope s JOIN bill_co_proposers c ON c.bill_id = s.bill_id
)
SELECT (SELECT COUNT(*) FROM scope)::int                                              AS total,
       (SELECT COUNT(*) FROM scope WHERE cmt_proc_dt IS NOT NULL)::int                AS cmt_done,
       (SELECT COUNT(*) FROM signed)::int                                             AS signed_total,
       (SELECT COUNT(*) FROM cross_party)::int                                        AS cross_party,
       (SELECT ROUND(AVG(CURRENT_DATE - propose_dt)) FROM scope
         WHERE proc_result_name IS NULL)::int                                         AS pending_days
