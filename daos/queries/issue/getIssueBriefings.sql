-- 이 쟁점의 법안이 발의된 날 중 브리핑 카드가 있는 날 (최신순)
--
-- 왜: 쟁점 페이지는 22대 전체를 모아 놓은 것이라 **지금도 움직이는지**가 안 보인다.
--     "최근 브리핑에 이 쟁점 법안이 있었다" 가 그 신호이자 브리핑으로 가는 길이다.
--
-- ⚠️ `bill_ids` 가 아니라 **날짜로 잇는다.** 카드의 bill_ids 는 그날의 **대표 5건**뿐이라
--    그걸로 매칭하면 실제 겹침을 크게 놓친다 (실측: bill_ids 기준 9/32 → 날짜 기준 19/32).
-- ⚠️ `briefing_date` 는 DATE, `propose_dt` 도 DATE 라 그대로 등치 비교한다.
-- 🔴 아래 WHERE 의 자리표시자는 IssueDao 가 조립한다 (getIssueBills.sql 과 같은 규칙).
SELECT bp.id,
       TO_CHAR(bp.briefing_date, 'YYYY-MM-DD') AS briefing_date,
       bp.headline,
       COUNT(b.bill_id)::int                   AS n
  FROM briefing_posts bp
  JOIN bills b ON b.propose_dt = bp.briefing_date
 WHERE __MATCH__
 GROUP BY bp.id, bp.briefing_date, bp.headline
 ORDER BY bp.briefing_date DESC
 LIMIT 5
