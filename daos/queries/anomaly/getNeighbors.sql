/* 상세의 이전/다음 카드 (날짜 기준) */
SELECT
  (SELECT card_date::text FROM anomaly_cards WHERE card_date < $1 ORDER BY card_date DESC LIMIT 1) AS prev,
  (SELECT card_date::text FROM anomaly_cards WHERE card_date > $1 ORDER BY card_date ASC  LIMIT 1) AS next
