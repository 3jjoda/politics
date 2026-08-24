-- 2026-08-23 · 법안 본문·법안명 부분일치 검색 인덱스 (pg_trgm)
--
-- 목적: "쟁점 키워드 → 관련 법안" 매칭을 가능하게 한다.
--   뉴스에서 시끄러운 말(법원행정처·전세사기·촉법소년)로 법안을 찾으려면
--   bill_name 만으로는 안 된다 — 법안의 87%가 동명이라 이름에는 쟁점이 안 들어 있고,
--   실제 내용은 bills.summary(제안이유 및 주요내용)에만 있다.
--
-- ─────────────────────────────────────────────────────────────
-- 🔴 왜 to_tsvector(전문검색)가 아니라 trigram 인가 — 한글에서 tsvector 는 못 쓴다
-- ─────────────────────────────────────────────────────────────
--   PostgreSQL 에는 한국어 사전이 없어 'simple' 을 쓰는데, simple 은 공백으로만 쪼갠다.
--   한국어는 교착어라 조사가 어간에 붙어 **조사째로 한 토큰**이 된다:
--
--     to_tsvector('simple','법원행정처를 폐지하고')
--       → '법원행정처를':1 '폐지하고':2          -- ← '법원행정처' 라는 토큰이 없다
--
--     @@ plainto_tsquery('simple','법원행정처')   → false   ❌ (실측)
--     @@ to_tsquery('simple','법원행정처:*')      → true    ← 접두 매칭일 때만
--
--   접두(:*)로도 부족하다. '행정처' 로 찾으면 '법원행정처를' 안에 있는데도 안 걸린다
--   (접두가 아니라 중간이라서). 즉 tsvector 는 한글 부분일치를 **구조적으로** 못 한다.
--
--   ⚠️ 그래서 기존 `idx_bills_bill_name`(GIN tsvector)은 이 프로젝트의 검색이
--      전부 ILIKE '%…%' 라서 **한 번도 쓰인 적이 없다.** 지우지는 않았다 —
--      나중에 tsvector 검색을 붙일 여지를 남긴다. 다만 ILIKE 를 가속한다고 오해하지 말 것.
--
--   → trigram 은 문자 3개 단위라 조사·위치와 무관하게 ILIKE '%…%' 를 가속한다.
--
-- ─────────────────────────────────────────────────────────────
-- 🔴 두 컬럼을 같이 거는 이유 — OR 는 한쪽만 인덱싱하면 통째로 Seq Scan 이다
-- ─────────────────────────────────────────────────────────────
--   쟁점 매칭 쿼리는 `bill_name ILIKE … OR summary ILIKE …` 형태가 된다.
--   OR 의 한 갈래라도 인덱스가 없으면 플래너는 BitmapOr 를 못 만들고 전체를 훑는다.
--   즉 summary 만 걸면 **이 인덱스는 실제 쿼리에서 안 쓰인다.** 둘은 세트다.
--
-- ⚠️ 검색어가 3글자 미만이면 trigram 이 안 만들어져 Seq Scan 으로 떨어진다.
--    2글자 검색은 어차피 노이즈라 허용한다 (쟁점어는 대개 3자 이상).
-- ⚠️ GIN 은 쓰기를 느리게 한다. syncBillSummary 는 증분(신규 법안만)이라 영향이 없지만
--    `--full` 백필(18,000건 UPDATE)은 눈에 띄게 느려진다. 그건 연 1회급이라 감수한다.
-- ⚠️ CONCURRENTLY 는 트랜잭션 안에서 못 돈다. 이 파일을 psql -1 / BEGIN 으로 감싸지 말 것.
--    실패하면 INVALID 인덱스가 남으므로 아래 검증 쿼리로 indisvalid 를 반드시 확인한다.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- 연산자 클래스를 스키마 한정한다 — search_path 에 extensions 가 없는 세션에서도 안전하게.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_summary_trgm
  ON bills USING gin (summary extensions.gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_bill_name_trgm
  ON bills USING gin (bill_name extensions.gin_trgm_ops);

-- getList.sql 의 검색 절이 3중 OR (bill_name / proposer_name / bill_no) 이라
-- proposer_name 까지 걸어야 `/bill?search=` 가 Seq Scan 을 벗어난다. 위 "OR 는 세트다" 와 같은 이유.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_proposer_name_trgm
  ON bills USING gin (proposer_name extensions.gin_trgm_ops);

-- 🔴 bill_no 에도 인덱스가 필요하다. **OR 는 갈래가 하나라도 비면 전부 Seq Scan 이다** —
--    trigram 두 개를 걸어도 bill_no 갈래가 인덱스를 못 타서 소용이 없었다 (실측 아래).
--    bill_no 는 7자 고정 · 18,830건 전부 고유한 자연키인데 인덱스가 없었다
--    (유일하게 bill_no 를 쓰는 idx_bills_summary_sync 는 partial 이라 일반 조회에 못 쓴다).
--    ⚠️ UNIQUE 로 걸지 않았다 — 원천이 중복을 주면 syncBills 트랜잭션이 통째로 깨진다
--       (politicians FK 를 안 건 것과 같은 판단).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_bill_no
  ON bills (bill_no);

COMMENT ON INDEX idx_bills_summary_trgm IS
  '쟁점 키워드 → 법안 매칭용. summary ILIKE ''%…%'' 를 가속한다. '
  '한글은 조사 때문에 to_tsvector 로 부분일치가 안 되므로 trigram 이어야 한다.';

-- ── 검증 (마이그레이션 후 반드시 실행) ────────────────────────
-- 1) 인덱스가 유효한가 (CONCURRENTLY 실패 시 indisvalid=false 로 남는다)
--    SELECT c.relname, i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
--     WHERE c.relname IN ('idx_bills_summary_trgm','idx_bills_bill_name_trgm');
--
-- 2) 실제로 타는가 — Bitmap Index Scan 이어야 한다 (Seq Scan 이면 실패)
--    EXPLAIN ANALYZE SELECT bill_id FROM bills WHERE summary ILIKE '%법원행정처%';
--
-- 3) OR 결합에서 BitmapOr 가 만들어지는가
--    EXPLAIN ANALYZE SELECT bill_id FROM bills
--     WHERE bill_name ILIKE '%법원조직법%' OR summary ILIKE '%법원행정처%';

-- ─────────────────────────────────────────────────────────────
-- ✅ 실측 (2026-08-23 적용 · bills 18,830행 / summary 18,788건 22MB)
-- ─────────────────────────────────────────────────────────────
--   생성: CONCURRENTLY 성공 (Transaction Pooler 6543 에서도 통과했다).
--         summary 16.9초 / bill_name 0.6초. 둘 다 indisvalid = true
--   크기: idx_bills_summary_trgm 36MB · idx_bills_bill_name_trgm 1,976kB
--         bills 총 크기 63MB → 100MB
--
--   속도 (Seq Scan → Bitmap Heap Scan):
--     summary '법원행정처'     28건   536ms → 9.5ms
--     summary '사법행정위원회'   3건   676ms → 2.9ms
--     summary '전세사기'      102건   617ms → 12.0ms
--     summary '촉법소년'       10건     -   → 1.1ms
--     bill_name '조세특례'     804건   155ms → 14.8ms
--     bill_name '법원조직법'    61건     -   → 0.6ms
--
--   🔴 OR 결합 검증 (이 마이그레이션의 존재 이유):
--     bill_name ILIKE '%법원조직법%' OR summary ILIKE '%법원행정처%'
--       → BitmapOr 생성 ✅ · Seq Scan 없음 · 1.5ms
--
--   ⚠️ 2글자는 예상대로 폴백한다: summary '국방' → Seq Scan 902ms.
--      trigram 이 안 만들어지는 길이라 정상이다. 쟁점어를 2글자로 잡지 말 것.
--
-- ─────────────────────────────────────────────────────────────
-- ✅ `/bill?search=` 3중 OR 도 같이 고쳤다
-- ─────────────────────────────────────────────────────────────
--   getList.sql 의 검색 절은 bill_name ILIKE … OR proposer_name ILIKE … OR bill_no = … 다.
--
--   🔴 **갈래를 하나씩 빼며 실측한 결과 — 세 개를 다 인덱싱해야 풀린다** ('조세특례'):
--        bill_name 단독                    3.2ms  Seq 없음
--        bill_name OR proposer_name        2.4ms  BitmapOr ✅
--        + OR bill_no                     69.0ms  ❌ Seq Scan  ← 갈래 하나가 전체를 끌어내린다
--        + idx_bills_bill_no 추가 후        3.8ms  BitmapOr ✅
--
--   ⚠️ 처음엔 "bill_no 는 등치라 플래너가 알아서 필터로 처리하겠지" 라고 적었는데 **틀렸다.**
--      플래너는 OR 의 **모든** 갈래에 인덱스 경로가 있을 때만 BitmapOr 를 만든다.
--      OR 절에 컬럼을 하나 더 붙일 때는 그 컬럼의 인덱스부터 확인할 것.
--
--   실측 (BitmapOr 적용 후): '조세특례' 3.8ms · '윤준병' 1.6ms · '법원조직법' 1.1ms (전 123ms)
