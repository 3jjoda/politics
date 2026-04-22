SELECT vote
  FROM bill_citizen_votes
 WHERE bill_id = $1 AND user_id = $2
