SELECT user_id, email, nickname, provider, provider_id, created_at
  FROM users
 WHERE user_id = $1
