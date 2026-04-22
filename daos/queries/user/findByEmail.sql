SELECT user_id, email, nickname, provider, provider_id, created_at
  FROM users
 WHERE email = $1
