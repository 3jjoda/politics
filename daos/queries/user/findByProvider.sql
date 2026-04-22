SELECT user_id, email, nickname, provider, provider_id, created_at
  FROM users
 WHERE provider = $1 AND provider_id = $2
