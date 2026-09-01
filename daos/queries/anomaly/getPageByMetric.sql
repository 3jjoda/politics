/* 지표로 거른 목록. `getPage` 와 정렬이 같아야 한다 (다르면 탭을 바꿀 때 순서가 어긋난다) */
SELECT id, card_date::text AS card_date, metric, mona_cd, explained, payload
  FROM anomaly_cards WHERE metric = $1 ORDER BY card_date DESC LIMIT $2 OFFSET $3
