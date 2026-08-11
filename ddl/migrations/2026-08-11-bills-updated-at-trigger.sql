-- 2026-08-11 bills.updated_at 트리거를 "원천 데이터 변경" 에만 반응하도록 교체
--
-- 문제:
--   bills 에는 공용 트리거 `trg_bills_updated_at → update_updated_at()` 이 걸려 있어
--   **어떤 UPDATE 든** updated_at 을 NOW() 로 민다.
--   그래서 syncBillSummary 가 summary 백필로 18,631행을 UPDATE 하자
--   전건의 updated_at 이 같은 시각으로 밀렸다.
--
-- 피해 (실측):
--   · syncVotes 증분 조건 `updated_at > vote_synced_at` 이 전건 참 → 4,541건 전건 재스캔 예약
--   · syncBillAiAnalysis 재분석 조건 `b.updated_at > a.analyzed_at` 이 전건 참 → 116건 오탐
--   · CLAUDE.md 에 명시된 "updated_at = 법안 실제 변경 시각" 계약이 깨짐
--   (nav 갱신 배지는 batch_runs 기반이라 무사)
--
-- 해결:
--   bills 전용 트리거 함수로 교체. **원천 데이터 컬럼이 실제로 바뀐 경우에만** updated_at 을 민다.
--   제외 대상은 우리 쪽 동기화 부기 컬럼:
--     · summary / summary_synced_at  — 법안 생애주기와 무관하게 뒤늦게 백필된다.
--                                      AI 분석은 pal.assembly.go.kr 크롤 본문을 쓰므로 이 값에 의존하지 않는다
--     · vote_synced_at               — 순수 스캔 기록. syncVotes 가 자기 증분 기준을 스스로 밀어 올리던 구조
--
-- ⚠️ 공용 `update_updated_at()` 은 다른 테이블들이 쓰므로 **건드리지 않는다.**
-- ⚠️ bills 에 컬럼을 추가하면 아래 ROW(...) 목록에도 넣어야 한다.
--    안 넣으면 그 컬럼 변경이 updated_at 을 못 밀어 증분 배치가 조용히 놓친다.

CREATE OR REPLACE FUNCTION bills_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- 원천(열린국회 API) 컬럼만 비교한다. 부기 컬럼(summary*, vote_synced_at)은 제외.
    -- ROW(...) IS DISTINCT FROM 은 NULL 도 올바르게 비교한다.
    IF ROW(NEW.bill_no, NEW.bill_name, NEW.bill_kind_cd, NEW.age_cd, NEW.age_name,
           NEW.proposer_kind_cd, NEW.proposer_name, NEW.mona_cd, NEW.co_proposer_count,
           NEW.propose_dt, NEW.committee, NEW.committee_id, NEW.proc_result_cd,
           NEW.proc_result_name, NEW.link_url, NEW.bill_topic_cd)
       IS DISTINCT FROM
       ROW(OLD.bill_no, OLD.bill_name, OLD.bill_kind_cd, OLD.age_cd, OLD.age_name,
           OLD.proposer_kind_cd, OLD.proposer_name, OLD.mona_cd, OLD.co_proposer_count,
           OLD.propose_dt, OLD.committee, OLD.committee_id, OLD.proc_result_cd,
           OLD.proc_result_name, OLD.link_url, OLD.bill_topic_cd)
    THEN
        NEW.updated_at := NOW();
    ELSE
        NEW.updated_at := OLD.updated_at;   -- 부기 컬럼만 바뀜 → 유지
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bills_updated_at ON bills;
CREATE TRIGGER trg_bills_updated_at
    BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION bills_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 오염 정리 — AI 분석 재분석 오탐 116건
--
-- 백필이 바꾼 건 summary / summary_synced_at 뿐이고, 이 둘은 AI 분석의 입력이 아니다
-- (분석은 pal.assembly.go.kr 크롤 본문 사용). 즉 분석 결과는 여전히 유효하다.
-- updated_at 의 원래 값은 복구할 수 없으므로, analyzed_at 을 현재 updated_at 까지 끌어올려
-- "이 상태까지는 확인했다" 로 만든다. 이후 진짜 변경이 생기면 정상적으로 재분석 대상이 된다.
--
-- ⚠️ syncVotes 쪽은 일부러 손대지 않는다. 오늘 밤 한 번 전건 재스캔(≈4,541건)하고
--    vote_synced_at 이 다시 찍히면 증분이 정상 복구된다. 스스로 수렴하는 게 설계 의도이고,
--    지금 updated_at 을 임의로 되돌리면 진짜로 상태가 바뀐 법안의 표결을 놓칠 수 있다.
-- ---------------------------------------------------------------------------
UPDATE bill_ai_analysis a
   SET analyzed_at = b.updated_at
  FROM bills b
 WHERE b.bill_id = a.bill_id
   AND b.updated_at > a.analyzed_at;

-- 운영 확인:
--   -- 부기 컬럼만 UPDATE 시 updated_at 이 유지되는지
--   SELECT count(*) FROM bills b JOIN bill_ai_analysis a USING (bill_id)
--    WHERE b.updated_at > a.analyzed_at;                       -- 0 이어야 함
--
--   SELECT tgname, p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
--    WHERE t.tgrelid = 'bills'::regclass AND NOT t.tgisinternal;   -- bills_touch_updated_at
