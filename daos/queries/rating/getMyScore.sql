SELECT score
  FROM politician_ratings
 WHERE politician_id = $1 AND user_id = $2
