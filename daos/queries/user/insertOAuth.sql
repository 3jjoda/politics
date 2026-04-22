/* OAuth 신규 가입
   $1 email, $2 nickname, $3 provider, $4 provider_id
*/
INSERT INTO users (email, nickname, provider, provider_id)
VALUES ($1, $2, $3, $4)
RETURNING user_id, email, nickname, provider, provider_id, created_at
