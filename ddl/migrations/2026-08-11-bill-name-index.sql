-- 2026-08-11 동명 법안 계열 카운트용 btree 인덱스
--
-- 배경:
--   법안의 87%가 동명이다 ("○○법 일부개정법률안" — 개정안은 법률명 하나로 이름이 고정됨).
--     전체 18,671건 / 고유 이름 2,488개
--     조세특례제한법 788건 · 공직선거법 310건 · 자본시장법 117건
--   목록 카드에 "같은 법률 N건 →" 을 달아, 반복돼 보이는 것이 중복이 아니라
--   원래 그런 계열이라는 걸 알려준다. 클릭하면 그 계열만 필터(`/bill?bill_name=...`).
--
-- 두 곳에서 쓴다:
--   1) getList.sql 의 상관 서브쿼리 — 페이지당 50건에 대해 각각 COUNT
--   2) bill_name 완전일치 필터 (`$12`) — 계열 링크의 착지점
--
-- ⚠️ 이름을 `idx_bills_bill_name` 으로 쓰면 안 된다 — 그 이름은 **이미 다른 인덱스가 쓰고 있다**:
--      CREATE INDEX idx_bills_bill_name ON bills USING gin (to_tsvector('simple', bill_name))
--    전문검색용 GIN 이라 `bill_name = '...'` 등치 비교에는 쓸 수 없다.
--    `CREATE INDEX IF NOT EXISTS` 는 **정의가 아니라 이름만 보고** 넘어가므로,
--    같은 이름으로 만들면 아무 에러 없이 무시되고 btree 는 끝내 생기지 않는다.
--    (실제로 이 함정에 걸렸다: 인덱스를 만들었다고 생각했는데 EXPLAIN 은 계속 Seq Scan,
--     enable_seqscan=off 로도 인덱스를 안 쓰길래 파보니 GIN 이었다)

CREATE INDEX IF NOT EXISTS idx_bills_bill_name_btree ON bills (bill_name);

-- 운영 확인:
--   EXPLAIN ANALYZE SELECT COUNT(*) FROM bills WHERE bill_name = '조세특례제한법 일부개정법률안';
--   → Index Only Scan using idx_bills_bill_name_btree 이어야 한다
--
--   -- 이름이 겹치는 인덱스가 또 생기지 않도록, 추가 전 정의를 먼저 확인할 것:
--   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bills';
