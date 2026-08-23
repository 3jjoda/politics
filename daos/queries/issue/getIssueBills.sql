-- 쟁점 키워드에 걸린 법안 전체 (정렬: 최신 발의순)
--
-- 🔴 아래 WHERE 의 자리표시자는 IssueDao 가 조립해 넣는다 (키워드 개수가 가변이라 정적 SQL 로 못 쓴다).
--    조립 규칙과 왜 ILIKE ANY(배열) 이 아닌지는 IssueDao.js 주석 참조.
-- ⚠️ 키워드는 utils/issues.js 의 코드 상수다. 사용자 입력이 여기 닿지 않는다 —
--    그래도 값은 전부 파라미터 바인딩한다 (조립되는 건 자리표시자뿐).
SELECT b.bill_id,
       b.bill_no,
       b.bill_name,
       b.proposer_name,
       b.mona_cd,
       p.party_name,
       p.photo_url,
       TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS propose_dt,
       b.proc_result_name,
       TO_CHAR(b.proc_dt, 'YYYY-MM-DD')    AS proc_dt,
       b.committee,
       (CURRENT_DATE - b.propose_dt)        AS pending_days,
       b.link_url,
       (a.bill_id IS NOT NULL)             AS has_analysis,
       a.summary                           AS ai_summary,
       a.changes                           AS ai_changes,
       a.affected                          AS ai_affected,
       LEFT(b.summary, 400)                AS raw_summary,
       (SELECT COUNT(*) FROM bill_co_proposers c WHERE c.bill_id = b.bill_id) AS co_count,
       (SELECT COUNT(*) FROM bill_votes      v WHERE v.bill_id = b.bill_id) AS vote_count
  FROM bills b
  LEFT JOIN politicians       p ON p.mona_cd = b.mona_cd
  LEFT JOIN bill_ai_analysis  a ON a.bill_id = b.bill_id
 WHERE __MATCH__
 ORDER BY b.propose_dt DESC NULLS LAST, b.bill_id DESC
