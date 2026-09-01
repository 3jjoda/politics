/* 카드는 한 번 쓰면 고치지 않는다 (브리핑과 같은 규칙).
   ⚠️ `--force` 로 다시 만들 때만 payload 를 덮는다. */
INSERT INTO anomaly_cards (card_date, metric, mona_cd, explained, payload)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (card_date) DO UPDATE SET
  metric = EXCLUDED.metric, mona_cd = EXCLUDED.mona_cd,
  explained = EXCLUDED.explained, payload = EXCLUDED.payload
RETURNING id, card_date::text AS card_date
