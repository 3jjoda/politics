-- 쟁점 후보 신호 ① — 본회의에서 **반대표가 실제로 나온** 법안
--
-- 왜 이게 가장 강한 신호인가: 본회의 반대표는 전체 표결의 **0.66%** 뿐이다.
-- 반대가 나왔다는 건 "실제로 의견이 갈렸다" 는 확정적 증거다.
-- ⚠️ 다만 **사후적**이다 — 이미 표결된 것만 잡는다. 전세사기·촉법소년처럼
--    계류 중인 뜨거운 주제는 이 신호로 못 찾는다. 후보 목록의 절반일 뿐이라는 뜻.
-- ⚠️ 실측(2026-08-23) 20표 이상이 표결 602건 중 **14건뿐**이다. 후보 풀이 원래 작다.
--
-- 인물·사건명 특검법은 제외한다 ($1 = EXCLUDE_PATTERN) — 쟁점으로 만들지 않기로 한 부류라
-- 후보 목록에 띄우면 매번 눈으로 걸러야 한다.
--   $1 배제 정규식 · $2 최소 반대표
SELECT b.bill_id,
       b.bill_name,
       b.committee,
       b.proposer_name,
       COALESCE(p.party_name, '(명부 없음)')                        AS party_name,
       TO_CHAR(b.proc_dt, 'YYYY-MM-DD')                            AS proc_dt,
       b.proc_result_name,
       COUNT(*) FILTER (WHERE v.vote_result = '반대')::int          AS no_votes,
       COUNT(*) FILTER (WHERE v.vote_result = '찬성')::int          AS yes_votes,
       -- 같은 이름의 법안이 몇 건인지 = 그 법률에 얼마나 몰렸는지 (키워드를 정할 때 재료가 된다)
       (SELECT COUNT(*) FROM bills x WHERE x.bill_name = b.bill_name)::int AS family
  FROM bill_votes v
  JOIN bills b USING (bill_id)
  LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
 WHERE b.bill_name !~ $1
 GROUP BY b.bill_id, b.bill_name, b.committee, b.proposer_name, p.party_name, b.proc_dt, b.proc_result_name
HAVING COUNT(*) FILTER (WHERE v.vote_result = '반대') >= $2
 ORDER BY no_votes DESC
