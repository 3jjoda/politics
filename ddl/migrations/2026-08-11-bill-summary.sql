-- 2026-08-11 법안 제안이유·주요내용 수집
--
-- 배경:
--   지금까지 법안의 "내용" 은 AI 분석(bill_ai_analysis)에만 존재했다.
--   AI 분석은 건당 $0.016 · 21초라 요청·가결 건에만 돌리고 있어서,
--   전체 18,671건 중 65건(0.3%)을 뺀 나머지는 목록·상세에 표시할 내용이 아예 없었다.
--   그 결과 "○○법 일부개정법률안" 동명 법안(전체의 87%)이 목록에서 구분되지 않는다.
--     예: 자본시장과 금융투자업에 관한 법률 일부개정법률안 117건
--         조세특례제한법 일부개정법률안 788건
--
-- 해결:
--   열린국회 API `BPMBILLSUMMARY` (법률안 제안이유 및 주요내용) 가
--   국회 공식 "제안이유 및 주요내용" 원문을 무료로 제공한다.
--     · 랜덤 140건 표본 커버리지 100% (빈값 0, 에러 0)
--     · 길이 306~2,076자 (중앙값 485자) → 전건 약 9MB
--     · 동시 10 호출 기준 건당 18ms → 18,671건 전량 5.6분
--     · 호출 제한 없음
--
--   AI 분석의 대체가 아니라 바닥. 역할이 다르다:
--     제안이유·주요내용 = 국회 원문 그대로(관 문체), 전건
--     AI 5-Zone 분석    = 쉬운 말 + 찬반 쟁점 + 판단 질문, 요청·가결 건만

-- ---------------------------------------------------------------------------
-- bills.summary — 국회 공식 "제안이유 및 주요내용" 원문
-- ---------------------------------------------------------------------------
ALTER TABLE bills ADD COLUMN IF NOT EXISTS summary TEXT;

COMMENT ON COLUMN bills.summary IS
  '열린국회 API BPMBILLSUMMARY 의 SUMMARY — 국회 공식 "제안이유 및 주요내용" 원문. '
  'AI 요약(bill_ai_analysis.summary)과 다름: 이쪽은 가공하지 않은 원문이고 전건 보유.';

-- ---------------------------------------------------------------------------
-- bills.summary_synced_at — syncBillSummary 가 이 법안을 마지막으로 조회한 시각
--   vote_synced_at 과 같은 패턴. NULL = 미조회 → 다음 실행 대상.
--   호출에 실패한 건은 마킹하지 않아 다음 실행에서 자동 재시도된다.
-- ---------------------------------------------------------------------------
ALTER TABLE bills ADD COLUMN IF NOT EXISTS summary_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN bills.summary_synced_at IS
  'syncBillSummary.js 가 이 법안의 제안이유·주요내용을 마지막으로 조회한 시각. '
  'NULL = 미조회. 본문은 발의 시점에 확정되어 이후 바뀌지 않으므로 '
  '한 번 성공하면 재조회하지 않는다 (--full 로 강제 재수집 가능).';

-- 증분 대상 조회 전용 부분 인덱스
--   WHERE 절이 조회 조건(summary_synced_at IS NULL)과 일치해서
--   전건 수집이 끝나면 인덱스가 사실상 비어 스캔 비용이 0에 수렴한다.
CREATE INDEX IF NOT EXISTS idx_bills_summary_sync
    ON bills (bill_no)
    WHERE summary_synced_at IS NULL;

-- ---------------------------------------------------------------------------
-- 참고
--   · 최초 실행은 전건(18,671) 수집 — 실측 약 6분. 이후 실행은 신규 발의분만(수십 건 · 수 초).
--   · 본문 자체가 갱신되는 경우는 없다고 보지만, 확인이 필요하면 `--full` 로 전건 재수집.
--
-- 운영 확인 쿼리:
--   SELECT count(*) FILTER (WHERE summary IS NOT NULL)        AS 수집완료,
--          count(*) FILTER (WHERE summary_synced_at IS NULL)  AS 미조회,
--          count(*) FILTER (WHERE summary_synced_at IS NOT NULL AND summary IS NULL) AS 빈응답,
--          count(*)                                           AS 전체
--     FROM bills;
