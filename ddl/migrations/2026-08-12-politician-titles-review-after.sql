-- 2026-08-12 직위 재확인 예정일 (`review_after`)
--
-- 왜:
--   기존 점검은 "updated_at 이 6개월 지났으면 경고" 였는데 너무 무디다.
--   원내대표 임기는 1년 관례라 바뀌고도 **6개월간 틀린 값이 노출**된다.
--
--   그런데 직위 교체는 대부분 **시점을 미리 안다**:
--     의장단   2년 (원구성)          — 후반기 2026.6 ~ 2028.5
--     원내대표 1년 관례              — 민주 05월경 · 국힘 08월경
--     당대표   2년 임기지만 사퇴 잦음 — 민주 전당대회 2026-08-17
--     장관     개각, 불규칙           — 유일하게 예측 불가
--   → 값을 넣을 때 "다음에 언제 확인할지" 를 같이 적어두면, 상시 모니터링 없이
--     배치가 때가 됐을 때 알려준다. **모니터링을 기억에서 데이터로 옮기는 것.**

ALTER TABLE politician_titles
  ADD COLUMN IF NOT EXISTS review_after DATE;

COMMENT ON COLUMN politician_titles.review_after IS
  '이 날짜가 지나면 배치가 "재확인 필요" 로 경고한다. 임기 만료 예정일·전당대회 다음 날 등. '
  'NULL 이면 updated_at + 6개월로 폴백한다 (감시에서 빠지는 행이 없도록). '
  '⚠️ 시점을 모르는 직위(장관 등)는 비워두지 말고 3개월 뒤쯤으로 적어둘 것 — '
  '폴백 6개월은 개각 주기보다 길다.';

CREATE INDEX IF NOT EXISTS idx_politician_titles_review
  ON politician_titles (review_after) WHERE review_after IS NOT NULL;

-- 확인:
--   SELECT p.name, t.title, t.review_after,
--          (COALESCE(t.review_after, (t.updated_at + INTERVAL '6 months')::date) <= CURRENT_DATE) AS 확인필요
--     FROM politician_titles t JOIN politicians p ON p.mona_cd = t.mona_cd
--    ORDER BY COALESCE(t.review_after, (t.updated_at + INTERVAL '6 months')::date);
