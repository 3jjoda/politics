-- 이 쟁점의 법안에 **이름을 가장 많이 올린 의원**
--
-- 왜: 쟁점 페이지에서 "누가 이걸 밀고 있나" 에 답할 수단이 정당 분포뿐이었고,
--     **의원 페이지로 가는 링크가 하나도 없었다.** 이 사이트의 축은 "당 말고 사람" 인데.
--
-- 🔴 순위표가 아니다. 공동발의는 **이름을 올린 것**이지 기여도가 아니다
--    (브리핑이 "공동발의 수 = 이름을 얼마나 걸었는지일 뿐" 이라고 병기하는 것과 같은 규칙).
--    화면이 그 한계를 각주로 밝히고 `1위` 같은 말을 쓰지 않는다.
-- ⚠️ 분포가 실제로 갈려서 신호가 된다 — 실측 국민연금 서명자 282명 중 중앙값 5건 · 최대 39건.
--    **중앙값과 총원을 같이 내려보낸다** — 숫자만 주면 39건이 많은 건지 알 수 없다
--    (평균선 없는 막대와 같은 문제. 사이트 공통 규칙).
-- ⚠️ 퇴임 의원은 politicians 조인이 비어 이름이 없다 → 화면이 mona_cd 폴백 + 링크를 걸지 않는다
--    (법안 상세 발의자 스택과 같은 판단 — 그 mona_cd 로 가면 상세가 404 다).
-- 🔴 아래 WHERE 의 자리표시자는 IssueDao 가 조립한다.
WITH sig AS (
    SELECT c.mona_cd, COUNT(*)::int AS n
      FROM bill_co_proposers c
      JOIN bills b ON b.bill_id = c.bill_id
     WHERE __MATCH__
     GROUP BY c.mona_cd
), agg AS (
    SELECT COUNT(*)::int                                        AS total_signers,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n)::int   AS median_n
      FROM sig
)
SELECT s.mona_cd,
       p.name,
       COALESCE(p.party_name, '(명부 없음)') AS party_name,
       p.electoral_district,
       s.n,
       a.total_signers,
       a.median_n
  FROM sig s
  LEFT JOIN politicians p ON p.mona_cd = s.mona_cd
 CROSS JOIN agg a
 ORDER BY s.n DESC, p.name ASC
 LIMIT 10
