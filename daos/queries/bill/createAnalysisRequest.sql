/* 분석 요청 생성 — 중복 시 무시 (UNIQUE 제약 활용) */
INSERT INTO bill_analysis_requests (bill_id, user_id)
VALUES ($1, $2)
ON CONFLICT (bill_id, user_id) DO NOTHING
RETURNING id
