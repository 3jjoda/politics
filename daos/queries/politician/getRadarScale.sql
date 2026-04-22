/* 레이더 스케일 기준값 — 의원 발의·공동발의 건수의 p90 (90백분위수)
   MAX 를 쓰면 상위 10% 아웃라이어에 압도당해 평범한 의원이 0처럼 보이므로
   p90 을 100% 기준으로 사용 (상위 아웃라이어는 코드에서 Math.min(100, ...) 로 자름).
   데이터가 아직 없으면 기본값(100, 500)으로 폴백.
*/
SELECT
  COALESCE((
    SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cnt) FROM (
      SELECT COUNT(*) AS cnt
        FROM bills
       WHERE mona_cd IS NOT NULL
       GROUP BY mona_cd
    ) p
  ), 100) AS max_propose,
  COALESCE((
    SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cnt) FROM (
      SELECT COUNT(*) AS cnt
        FROM bill_co_proposers
       WHERE proposer_yn = FALSE
         AND mona_cd IS NOT NULL
       GROUP BY mona_cd
    ) cp
  ), 500) AS max_co_propose
