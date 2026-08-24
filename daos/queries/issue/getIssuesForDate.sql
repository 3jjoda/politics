-- 특정 날짜에 발의된 법안 중 **한 쟁점**에 걸리는 건수
--
-- 브리핑 상세에서 "이날 이 쟁점에 새 법안이 있었다" 를 그리는 데 쓴다.
-- 쟁점마다 키워드 집합이 달라 한 방에 못 묶으므로 쟁점 수만큼 호출하고 Promise.all 로 병렬화한다
-- (쟁점 6개 × 하루치 법안이라 비용이 없다. 서비스가 10분 캐시로 한 번 더 덮는다).
-- 🔴 아래 WHERE 의 자리표시자는 IssueDao 가 조립한다.
SELECT COUNT(*)::int AS n
  FROM bills b
 WHERE b.propose_dt = $1::date
   AND __MATCH__
