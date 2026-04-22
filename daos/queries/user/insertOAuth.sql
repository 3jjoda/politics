/* OAuth 신규 가입
   $1 email, $2 nickname, $3 provider, $4 provider_id, $5 gender, $6 age_group
*/
INSERT INTO users (email, nickname, provider, provider_id, gender, age_group)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING user_id, email, nickname, provider, provider_id, gender, age_group, created_at
