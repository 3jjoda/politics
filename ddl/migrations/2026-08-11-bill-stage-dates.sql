-- 2026-08-11 법안 처리 단계 날짜 저장
--
-- 배경:
--   `bills` 는 처리 "결과"(proc_result_name)만 갖고 있고 **언제 처리됐는지**가 없었다.
--   그래서 "어제 가결된 법안" 같은 질문에 답할 수 없었고, 상태 변경 이력 테이블을
--   따로 만들어야 하나 검토했었다 (그러면 오늘부터만 쌓인다).
--
--   그런데 syncBills 가 이미 쓰는 API(`nzmimeepazxkubdpn`)가 처리 단계 날짜를
--   **전부 주고 있었다.** 받아놓고 버리는 중이었을 뿐이다.
--     PROPOSE_DT → COMMITTEE_DT → CMT_PRESENT_DT → CMT_PROC_DT(+RESULT)
--                → LAW_SUBMIT_DT → LAW_PRESENT_DT → LAW_PROC_DT(+RESULT) → PROC_DT
--
--   즉 **추가 API 호출 0회, 새 배치 0개**로 전건 소급 확보가 가능하다.
--   이력 테이블은 만들지 않는다.
--
-- 실제 응답 예 (BILL_NO 2216993, 인천광역시 서구 명칭 변경에 관한 법률안):
--   발의 02-24 → 소관위 회부 02-25 → 위원회 상정/처리 04-29(원안가결)
--   → 법사위 회부 04-30 → 법사위 상정/처리 05-06(수정가결) → 본회의 의결 05-07(원안가결)

ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS committee_dt    DATE,         -- 소관위 회부일   (COMMITTEE_DT)
    ADD COLUMN IF NOT EXISTS cmt_present_dt  DATE,         -- 위원회 상정일   (CMT_PRESENT_DT)
    ADD COLUMN IF NOT EXISTS cmt_proc_dt     DATE,         -- 위원회 처리일   (CMT_PROC_DT)
    ADD COLUMN IF NOT EXISTS cmt_proc_result VARCHAR(50),  -- 위원회 처리결과 (CMT_PROC_RESULT_CD)
    ADD COLUMN IF NOT EXISTS law_submit_dt   DATE,         -- 법사위 회부일   (LAW_SUBMIT_DT)
    ADD COLUMN IF NOT EXISTS law_present_dt  DATE,         -- 법사위 상정일   (LAW_PRESENT_DT)
    ADD COLUMN IF NOT EXISTS law_proc_dt     DATE,         -- 법사위 처리일   (LAW_PROC_DT)
    ADD COLUMN IF NOT EXISTS law_proc_result VARCHAR(50),  -- 법사위 처리결과 (LAW_PROC_RESULT_CD)
    ADD COLUMN IF NOT EXISTS proc_dt         DATE;         -- 본회의 의결일   (PROC_DT)

COMMENT ON COLUMN bills.proc_dt IS
  '본회의 의결일 (열린국회 nzmimeepazxkubdpn 의 PROC_DT). '
  'proc_result_name 이 "언제" 확정됐는지를 말해준다 — "어제 처리된 법안" 조회의 기준.';
COMMENT ON COLUMN bills.cmt_proc_dt IS
  '소관위원회 처리일. 본회의까지 못 간 법안(대안반영폐기 등)도 이 값은 채워진다.';

-- ⚠️ `*_RESULT_CD` 라는 API 필드명과 달리 값은 코드가 아니라 텍스트다 ('원안가결', '대안반영폐기').
--    그래서 컬럼명에서 _cd 를 뺐다.

-- 브리핑/타임라인 조회용 부분 인덱스 — 값이 있는 행만 (계류 법안이 대부분이라 인덱스가 작다)
CREATE INDEX IF NOT EXISTS idx_bills_proc_dt     ON bills (proc_dt DESC)     WHERE proc_dt IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_cmt_proc_dt ON bills (cmt_proc_dt DESC) WHERE cmt_proc_dt IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at 트리거 갱신 — 새 컬럼도 "원천 데이터" 다.
-- ⚠️ 이걸 빠뜨리면 단계 날짜가 채워져도 updated_at 이 안 밀려서
--    syncVotes/syncBillAiAnalysis 증분이 그 변경을 조용히 놓친다.
--    (2026-08-11-bills-updated-at-trigger.sql 의 경고 그대로)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bills_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF ROW(NEW.bill_no, NEW.bill_name, NEW.bill_kind_cd, NEW.age_cd, NEW.age_name,
           NEW.proposer_kind_cd, NEW.proposer_name, NEW.mona_cd, NEW.co_proposer_count,
           NEW.propose_dt, NEW.committee, NEW.committee_id, NEW.proc_result_cd,
           NEW.proc_result_name, NEW.link_url, NEW.bill_topic_cd,
           NEW.committee_dt, NEW.cmt_present_dt, NEW.cmt_proc_dt, NEW.cmt_proc_result,
           NEW.law_submit_dt, NEW.law_present_dt, NEW.law_proc_dt, NEW.law_proc_result,
           NEW.proc_dt)
       IS DISTINCT FROM
       ROW(OLD.bill_no, OLD.bill_name, OLD.bill_kind_cd, OLD.age_cd, OLD.age_name,
           OLD.proposer_kind_cd, OLD.proposer_name, OLD.mona_cd, OLD.co_proposer_count,
           OLD.propose_dt, OLD.committee, OLD.committee_id, OLD.proc_result_cd,
           OLD.proc_result_name, OLD.link_url, OLD.bill_topic_cd,
           OLD.committee_dt, OLD.cmt_present_dt, OLD.cmt_proc_dt, OLD.cmt_proc_result,
           OLD.law_submit_dt, OLD.law_present_dt, OLD.law_proc_dt, OLD.law_proc_result,
           OLD.proc_dt)
    THEN
        NEW.updated_at := NOW();
    ELSE
        NEW.updated_at := OLD.updated_at;   -- 부기 컬럼(summary*, vote_synced_at)만 바뀜 → 유지
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- ⚠️ 실행 순서 (프로덕션 포함)
--   1) 이 마이그레이션
--   2) `node batch/syncBills.js`  — 단계 날짜 전건 소급 (추가 API 호출 없음, ~90초)
--   3) 아래 정리 쿼리
--
-- 왜 3)이 필요한가:
--   2) 에서 단계 날짜가 NULL → 값 으로 바뀌면 트리거가 **정상적으로** updated_at 을 민다.
--   그 결과 이미 분석된 법안이 전부 `b.updated_at > a.analyzed_at` (재분석 대상)이 된다.
--   백필 아티팩트일 뿐 법안 내용이 바뀐 게 아니고, 단계 날짜는 AI 분석 입력도 아니다.
--   (앞으로 단계가 실제로 진행돼 날짜가 채워지는 건 진짜 변경이므로 재분석 대상이 맞다)
--
--   UPDATE bill_ai_analysis a
--      SET analyzed_at = b.updated_at
--     FROM bills b
--    WHERE b.bill_id = a.bill_id AND b.updated_at > a.analyzed_at;
-- ---------------------------------------------------------------------------

-- 운영 확인:
--   SELECT count(*) FILTER (WHERE proc_dt IS NOT NULL)     AS 본회의처리,
--          count(*) FILTER (WHERE cmt_proc_dt IS NOT NULL) AS 위원회처리,
--          count(*) AS 전체 FROM bills;
--
--   -- 어제 본회의에서 처리된 법안
--   SELECT bill_name, proc_result_name FROM bills WHERE proc_dt = CURRENT_DATE - 1;
