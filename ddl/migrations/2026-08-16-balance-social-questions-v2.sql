-- 2026-08-16 — 종합팩 사회·문화 문항 교체 (눈금 보정 3단계)
--
-- 왜: 의원 사회축 좌표는 공동발의 × 매핑 법안으로 만드는데, 옛 사회 문항 5개 중 4개(차별금지·동성혼·사형제·마약)는
--     코퍼스에 법안이 0~2건이라 문항과 좌표가 **다른 쟁점**을 재고 있었다 (CLAUDE.md 「눈금 보정 실측」).
--     매핑 안 사회 법안 494건을 법률 단위로 세어 **양방향 법안이 실제로 있는 쟁점** 4개로 바꾼다:
--       집시법 17/9 · 정보통신망법 22/11(+형법 명예훼손) · 공직선거법 외국인 선거권·출입국관리법 8 · 소년법 10/0
--
-- 방식: 🔴 기존 id 를 덮어쓰지 않는다 — q6·q7·q8·q10 은 is_active=FALSE 로 남기고 새 id(q21~q24)를 같은 display_order 로 넣는다.
--       기존 응답(6명)이 새 문항에 답한 것처럼 섞이면 안 된다. 그 6명은 새 4문항만 이어서 풀면 된다.
--       ⚠️ 이 마이그레이션과 함께 `BalanceGameDao.recomputeUserAxisScore` 가 **활성 문항의 응답만** 집계하도록 바뀌었다 —
--          안 바꾸면 옛 응답이 좌표에 계속 섞이고, 완료 판정(20/20)도 옛 응답으로 채워져 새 문항을 안 풀어도 완료가 된다.
--       실행 후 아래 하단의 재계산을 돌려 기존 완료자를 16/20 상태로 되돌릴 것.
--
-- 뺀 셋(차별금지·동성혼·사형제)은 버리는 게 아니라 주제팩(젠더·가족 정책 등)으로 옮길 후보다 — 종합팩 = 의원 매칭 기준.
-- 부호 규약은 그대로: 사회 = 전통 −1 / 자율 +1 (AXIS_META.social L/R).

BEGIN;

UPDATE balance_game_questions
   SET is_active = FALSE, updated_at = NOW()
 WHERE id IN ('q6', 'q7', 'q8', 'q10') AND pack_id = 'general';

-- q9 유지 — 게임만 묻던 것을 온라인 전반(게임·SNS)으로 넓힌다. 앵커: 게임산업법 5 + 정보통신망법 16세 미만 SNS 이용 제한
UPDATE balance_game_questions
   SET prompt = '청소년의 게임·SNS 이용 시간이나 콘텐츠를 국가가 제한하면 보호 효과는 있지만, 청소년과 보호자의 자율 판단을 제약합니다.',
       updated_at = NOW()
 WHERE id = 'q9' AND pack_id = 'general';

INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('q21', 'general', 'social',
   '야간 집회나 주거지·학교 인근 집회를 더 제한하면 주민 생활과 질서는 지켜지지만, 집회·표현의 자유는 그만큼 좁아집니다.',
   '질서 위해 제한 강화', -1,
   '집회·표현 자유 확대', 1,
   6, TRUE, 'v1'),

  ('q22', 'general', 'social',
   '온라인 명예훼손·허위정보 규제를 강화하면 피해자 보호는 강해지지만, 사실을 말하는 것까지 위축될 수 있다는 우려가 있습니다.',
   '규제 강화로 피해 방지', -1,
   '표현의 자유 우선', 1,
   7, TRUE, 'v1'),

  ('q23', 'general', 'social',
   '외국인·이주민의 지방선거 참정권이나 체류 권리를 넓히자는 입장과, 국적을 기준으로 제한을 유지하자는 입장이 맞섭니다.',
   '국적 기준 제한 유지', -1,
   '이주민 권리 확대', 1,
   8, TRUE, 'v1'),

  ('q24', 'general', 'social',
   '촉법소년 연령을 낮추고 소년범 처벌을 강화하자는 입장과, 처벌보다 교화·보호가 먼저라는 입장이 맞섭니다.',
   '처벌 강화', -1,
   '교화·보호 우선', 1,
   10, TRUE, 'v1')
ON CONFLICT (id) DO UPDATE SET
  pack_id = EXCLUDED.pack_id,
  axis = EXCLUDED.axis,
  prompt = EXCLUDED.prompt,
  option_a_text = EXCLUDED.option_a_text,
  option_a_score = EXCLUDED.option_a_score,
  option_b_text = EXCLUDED.option_b_text,
  option_b_score = EXCLUDED.option_b_score,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  mapping_version = EXCLUDED.mapping_version,
  updated_at = NOW();

COMMIT;

-- 검증: 종합팩 활성 20문항 · 사회 5 (q9, q21~q24) · packs.question_count 20 과 일치해야 한다
-- SELECT axis, COUNT(*) FROM balance_game_questions WHERE pack_id='general' AND is_active GROUP BY 1;

-- 기존 응답자 좌표 재계산 (활성 문항만 반영 → 완료자는 16/20 으로 돌아가고 완료 배지가 내려간다):
--   node -e "..." 대신 서비스 경로를 쓴다: 각 user_id 에 대해 BalanceGameDao.recomputeUserAxisScore(userId, 'v1')
--   (2026-08-16 실행: batch 없이 아래 스크립트로 6명 재계산 — 이 파일 하단 주석 참조)
