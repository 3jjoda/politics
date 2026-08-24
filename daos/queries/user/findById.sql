SELECT user_id, email, nickname, provider, provider_id, created_at,
       gender, age_group, welcomed_at, district
  FROM users
 WHERE user_id = $1
