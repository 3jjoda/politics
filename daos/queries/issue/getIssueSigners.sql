-- 이 쟁점의 법안에 **이름을 올린** 의원 — 정당별 고유 인원
--
-- ⚠️ 법안 건수(대표발의 기준)와 다른 단위다. 한 의원이 여러 건에 서명해도 1로 센다.
--    화면이 두 숫자를 나란히 쓰므로 단위 차이를 각주로 밝힐 것.
-- ⚠️ politicians 조인이 비는 경우가 있다 (퇴임 의원 — politicians 는 현직만 담는다).
--    그건 '(명부 없음)' 으로 묶는다. 실제 정당인 '무소속' 과 구분하기 위한 라벨이다.
-- 🔴 아래 WHERE 의 자리표시자는 IssueDao 가 조립한다 (getIssueBills.sql 과 같은 규칙).
SELECT COALESCE(p.party_name, '(명부 없음)') AS party_name,
       COUNT(DISTINCT c.mona_cd)::int        AS n
  FROM bill_co_proposers c
  JOIN bills b        ON b.bill_id = c.bill_id
  LEFT JOIN politicians p ON p.mona_cd = c.mona_cd
 WHERE __MATCH__
 GROUP BY 1
 ORDER BY 2 DESC
