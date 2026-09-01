SELECT id, card_date::text AS card_date, metric, mona_cd, explained, payload,
       COUNT(*) OVER() AS total
  FROM anomaly_cards ORDER BY card_date DESC LIMIT $1 OFFSET $2
