SELECT id, card_date::text AS card_date, metric, mona_cd, explained, payload
  FROM anomaly_cards WHERE card_date = $1
