-- ============================================================
-- 밸런스 게임 시드 데이터
-- 5팩 (종합 + 노동·복지 + 부동산·주거 + 외교·안보 심화 + 젠더·가족)
-- 총 60문항
-- mapping_version: v1
-- 작성일: 2026-04-26
-- 의존: balance_game_packs, balance_game_questions 테이블
--      (etc/ddl/migrations/2026-04-XX-balance-game-cumulative.sql)
--
-- 임포트 정책: ON CONFLICT DO UPDATE (idempotent)
-- - 이미 존재하는 ID(예: CLI가 시드한 종합팩 q1~q20)는 본 SQL 내용으로 갱신
-- - 본 SQL이 권위 있는 v1 버전. 재실행해도 안전.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. 게임팩 마스터
-- ============================================================

INSERT INTO balance_game_packs (id, title, description, question_count, is_general, is_active, display_order)
VALUES
  ('general',  '정치 성향 종합 진단',
   '4축(경제·사회·안보·정치제도)에 걸친 20문항으로 자기 입장의 입체적 모양을 그려봅니다. 처음 풀어볼 게임팩.',
   20, TRUE, TRUE, 0),

  ('labor',    '노동·복지 정책',
   '주휴수당·기본소득·노조 등 한국 노동 시장을 가르는 10가지 트레이드오프.',
   10, FALSE, TRUE, 1),

  ('housing',  '부동산·주거 정책',
   '종부세·임대차 3법·재건축 등 한국 정치에서 가장 폭발력 있는 영역의 10문항.',
   10, FALSE, TRUE, 2),

  ('security', '외교·안보 심화',
   '주한미군·전작권·한일 GSOMIA 등 종합팩의 안보 5문항을 깊이 파는 10문항.',
   10, FALSE, TRUE, 3),

  ('gender',   '젠더·가족 정책',
   '군 복무·낙태·다양한 가족 형태 등 한국 사회에서 가장 첨예한 10가지 입장.',
   10, FALSE, TRUE, 4)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  question_count = EXCLUDED.question_count,
  is_general = EXCLUDED.is_general,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;


-- ============================================================
-- 2. 종합팩 (general) — 20문항
-- ============================================================
-- 경제 5 / 사회·문화 5 / 안보·외교 5 / 정치제도 5
-- 반전: q2, q4, q8, q9, q12, q15, q17, q20

-- 경제 축 (시장 -, 개입 +)
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('q1',  'general', 'economy',
   '최저임금이 빠르게 오르면 저임금 노동자의 생활은 안정되지만, 자영업자·소상공인의 인건비 부담이 커집니다. 어느 쪽을 더 중요하게 보세요?',
   '노동자 생활 안정', 1,
   '자영업자 부담 완화', -1,
   1, TRUE, 'v1'),

  ('q2',  'general', 'economy',
   '다주택자에게 무거운 세금을 매기면 투기는 줄지만, 임대 시장이 위축돼 세입자가 집을 구하기 어려워질 수 있습니다.',
   '세 부담 완화로 시장 활성화', -1,
   '다주택 중과로 투기 억제', 1,
   2, TRUE, 'v1'),

  ('q3',  'general', 'economy',
   '대기업 규제를 강화하면 중소기업·소비자 보호는 강해지지만, 대기업의 투자·고용은 위축될 수 있습니다.',
   '규제 강화로 공정 시장', 1,
   '규제 완화로 투자 활성화', -1,
   3, TRUE, 'v1'),

  ('q4',  'general', 'economy',
   '주 52시간을 엄격히 적용하면 노동자 건강은 보호되지만, 업종별 특성에 따른 유연한 근무가 어려워집니다.',
   '업종별 유연 근무 허용', -1,
   '52시간 엄격 적용', 1,
   4, TRUE, 'v1'),

  ('q5',  'general', 'economy',
   '공공병원·의대 정원을 늘리면 의료 접근성은 개선되지만, 민간 의료의 자율성과 의사 처우 협상력이 약화될 수 있습니다.',
   '공공의료 확대', 1,
   '민간 자율 유지', -1,
   5, TRUE, 'v1')
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

-- 사회·문화 축 (전통 -, 자율 +)
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('q6',  'general', 'social',
   '차별금지법이 제정되면 소수자의 권리는 강화되지만, 종교·사상의 자유 표현이 제약될 수 있다는 우려가 있습니다.',
   '제정해야 한다', 1,
   '신중해야 한다', -1,
   6, TRUE, 'v1'),

  ('q7',  'general', 'social',
   '동성결혼을 법적으로 인정하면 소수자 권리는 보장되지만, 전통적 가족 제도 변화에 사회적 합의가 필요하다는 의견도 있습니다.',
   '법적 인정', 1,
   '사회적 합의가 우선', -1,
   7, TRUE, 'v1'),

  ('q8',  'general', 'social',
   '사형제는 흉악범죄 억제 효과가 있다는 입장과, 인권·오판 가능성 측면에서 폐지해야 한다는 입장이 맞섭니다.',
   '유지·집행 재개', -1,
   '폐지', 1,
   8, TRUE, 'v1'),

  ('q9',  'general', 'social',
   '청소년 게임 시간·콘텐츠를 국가가 규제하면 보호 효과는 있지만, 청소년·보호자의 자율 판단을 제약합니다.',
   '보호 위해 규제 강화', -1,
   '자율 판단 존중', 1,
   9, TRUE, 'v1'),

  ('q10', 'general', 'social',
   '마약 사용자를 처벌 위주로 다룰지, 의료·재활 모델로 다룰지 의견이 갈립니다.',
   '의료·재활 중심', 1,
   '처벌 강화', -1,
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

-- 안보·외교 축 (동맹·강경 -, 자주·대화 +)
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('q11', 'general', 'security',
   '한미일 군사 협력을 강화하면 대북·대중 억제력은 커지지만, 한국 외교의 자주성과 한일 과거사 문제가 후순위로 밀릴 수 있습니다.',
   '협력 강화', -1,
   '신중·자주 외교 우선', 1,
   11, TRUE, 'v1'),

  ('q12', 'general', 'security',
   '북한에 대해 대화·교류를 우선할지, 압박·제재를 우선할지 입장이 갈립니다.',
   '대화·교류 우선', 1,
   '압박·제재 우선', -1,
   12, TRUE, 'v1'),

  ('q13', 'general', 'security',
   '강제동원·위안부 등 과거사 해법에 대해 미래지향적 협력을 우선할지, 과거사 정리를 우선할지 입장이 갈립니다.',
   '미래지향적 협력', -1,
   '과거사 정리 우선', 1,
   13, TRUE, 'v1'),

  ('q14', 'general', 'security',
   '북핵 위협 대응으로 자체 핵무장을 검토할지, 비핵화 원칙을 유지할지 의견이 갈립니다.',
   '검토 가능', -1,
   '비핵화 유지', 1,
   14, TRUE, 'v1'),

  ('q15', 'general', 'security',
   '미중 갈등 속에서 한국이 어느 쪽에 더 무게를 둘지 입장이 갈립니다.',
   '균형 외교', 1,
   '미국 동맹 강화', -1,
   15, TRUE, 'v1')
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

-- 정치제도 축 (안정 -, 개혁 +)
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('q16', 'general', 'institution',
   '검찰의 수사·기소권 분리 또는 공수처·경찰로의 분산은 권력 견제 효과가 있다는 입장과, 수사 효율성·전문성 약화 우려가 있다는 입장이 맞섭니다.',
   '권한 분산·견제 강화', 1,
   '현 체제 유지', -1,
   16, TRUE, 'v1'),

  ('q17', 'general', 'institution',
   '연동형 비례대표제는 소수정당 진입을 돕지만, 위성정당 같은 부작용과 선거제도의 복잡성이 지적됩니다.',
   '폐지·단순화', -1,
   '강화·소수정당 진입 보장', 1,
   17, TRUE, 'v1'),

  ('q18', 'general', 'institution',
   '현 5년 단임 대통령제를 4년 중임 또는 의원내각제 등으로 개편하자는 논의가 있습니다.',
   '권력 분산형으로 개편', 1,
   '현 체제 안정 유지', -1,
   18, TRUE, 'v1'),

  ('q19', 'general', 'institution',
   '대법원장·헌법재판관 임명 과정에서 정치적 영향력을 줄일지, 민주적 통제를 강화할지 입장이 갈립니다.',
   '사법부 독립 강화', -1,
   '민주적 통제 강화', 1,
   19, TRUE, 'v1'),

  ('q20', 'general', 'institution',
   '선거관리위원회 운영을 현 체제로 유지할지, 외부 감사·견제를 강화할지 입장이 갈립니다.',
   '외부 감사 강화', 1,
   '현 체제 유지', -1,
   20, TRUE, 'v1')
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


-- ============================================================
-- 3. 노동·복지팩 (labor) — 10문항
-- ============================================================
-- 경제 5 / 사회 3 / 정치제도 2
-- 반전: labor_q2, labor_q8

-- 경제 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('labor_q1', 'labor', 'economy',
   '주 15시간 이상 일하면 받는 주휴수당을 폐지하자는 의견이 있습니다. 자영업자·소상공인의 인건비 부담은 줄지만, 주 5일 일하는 노동자의 실질 시급이 약 17% 감소합니다.',
   '폐지로 인건비 부담 완화', -1,
   '유지로 노동자 실질임금 보호', 1,
   1, TRUE, 'v1'),

  ('labor_q2', 'labor', 'economy',
   '호봉제(연차 따라 임금 상승) 대신 성과급제(실적 따라 임금 차등)를 공공기관·대기업에 확대하자는 논의가 있습니다. 성과 보상은 강해지지만, 노동자 간 경쟁이 심해지고 평가 기준의 공정성 시비가 생길 수 있습니다.',
   '성과급제 확대로 보상 차등화', -1,
   '호봉제 유지로 안정성 보장', 1,
   2, TRUE, 'v1'),

  ('labor_q3', 'labor', 'economy',
   '일정 기간 이상 근속한 비정규직을 정규직으로 전환하도록 의무화하자는 입장과, 기업의 고용 유연성을 위해 자율에 맡기자는 입장이 갈립니다.',
   '전환 의무화로 고용 안정', 1,
   '기업 자율로 고용 유연성', -1,
   3, TRUE, 'v1'),

  ('labor_q4', 'labor', 'economy',
   '노조의 단체교섭권을 강화하면 노동자 협상력은 커지지만, 잦은 파업과 기업 의사결정 지연이 우려됩니다.',
   '단체교섭권 강화', 1,
   '사용자 권한 보호', -1,
   4, TRUE, 'v1'),

  ('labor_q5', 'labor', 'economy',
   '모든 국민에게 일정 금액을 무조건 지급하는 기본소득을 도입하자는 입장과, 현행 선별 복지를 유지·강화하자는 입장이 맞섭니다.',
   '기본소득 도입', 1,
   '현행 선별 복지 유지', -1,
   5, TRUE, 'v1')
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

-- 사회 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('labor_q6', 'labor', 'social',
   '외국인 노동자에게 내국인과 동등한 노동권·사회보장을 보장할지, 체류 자격에 따라 차등 적용할지 의견이 갈립니다.',
   '내국인과 동등한 권리', 1,
   '체류 자격에 따라 차등', -1,
   6, TRUE, 'v1'),

  ('labor_q7', 'labor', 'social',
   '부(아빠) 육아휴직을 법으로 의무화하면 성평등 육아 문화는 빠르게 정착되지만, 가정마다 다른 사정을 무시하고 일률적 강제가 된다는 우려가 있습니다.',
   '의무화로 성평등 육아', 1,
   '가정 자율 선택 존중', -1,
   7, TRUE, 'v1'),

  ('labor_q8', 'labor', 'social',
   '일·가정 양립을 위해 국가가 보육·돌봄에 적극 개입할지, 가족 단위 자율과 민간 시장에 맡길지 입장이 갈립니다.',
   '가족·민간 자율', -1,
   '국가의 적극 개입', 1,
   8, TRUE, 'v1')
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

-- 정치제도 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('labor_q9', 'labor', 'institution',
   '노동위원회의 독립성·판정 권한을 강화하면 노동 분쟁 해결이 빨라지지만, 사법부와의 권한 충돌과 행정기구 비대화가 우려됩니다.',
   '독립성·권한 강화', 1,
   '현행 체제 유지', -1,
   9, TRUE, 'v1'),

  ('labor_q10', 'labor', 'institution',
   '공공기관 이사회에 노동자 대표를 참여시키는 노동이사제를 확대할지, 경영 효율성을 위해 축소할지 입장이 갈립니다.',
   '확대', 1,
   '축소', -1,
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


-- ============================================================
-- 4. 부동산·주거팩 (housing) — 10문항
-- ============================================================
-- 경제 8 / 사회 2
-- 반전: housing_q2, housing_q4

INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('housing_q1', 'housing', 'economy',
   '종합부동산세를 강화하면 부동산 보유 부담이 커져 투기 수요는 줄지만, 1주택 장기 보유자도 부담이 커져 거주 안정성이 위협받는다는 우려가 있습니다.',
   '종부세 강화로 보유세 비중 확대', 1,
   '종부세 완화로 거주 안정성 보호', -1,
   1, TRUE, 'v1'),

  ('housing_q2', 'housing', 'economy',
   '분양가 상한제를 완화하면 신규 공급이 늘어 장기적으로 가격 안정에 도움된다는 입장과, 단기 분양가가 급등해 청약 진입 장벽이 더 높아진다는 입장이 갈립니다.',
   '완화로 공급 활성화', -1,
   '유지·확대로 분양가 통제', 1,
   2, TRUE, 'v1'),

  ('housing_q3', 'housing', 'economy',
   '임대차 3법(계약갱신요구권·전월세상한제·전월세신고제)을 유지하면 세입자 거주 안정성은 강화되지만, 임대인의 임대 의욕이 줄어 매물이 감소하고 전세값이 오른다는 비판이 있습니다.',
   '유지·강화로 세입자 보호', 1,
   '완화로 임대 시장 활성화', -1,
   3, TRUE, 'v1'),

  ('housing_q4', 'housing', 'economy',
   '재건축·재개발 규제를 완화하면 노후 주택 개선과 공급이 늘지만, 원주민 이탈과 투기 자본 유입으로 지역 공동체가 무너진다는 우려가 있습니다.',
   '규제 완화로 공급 확대', -1,
   '공공성 강화·기부채납 의무', 1,
   4, TRUE, 'v1'),

  ('housing_q5', 'housing', 'economy',
   '주택담보대출 LTV(40%)·DSR(40%) 규제를 유지하면 가계부채 위험은 억제되지만, 자산이 부족한 청년·신혼부부의 내 집 마련이 사실상 어려워진다는 지적이 있습니다.',
   '규제 유지·강화로 부채 관리', 1,
   '규제 완화로 실수요자 진입', -1,
   5, TRUE, 'v1'),

  ('housing_q6', 'housing', 'economy',
   '공공임대주택을 대폭 확대하자는 입장과, 민간 임대 시장 활성화에 맡기고 공공은 최저소득층에 집중하자는 입장이 맞섭니다.',
   '공공임대 대폭 확대', 1,
   '민간 임대 시장 중심', -1,
   6, TRUE, 'v1'),

  ('housing_q7', 'housing', 'economy',
   '1주택 장기 보유자의 양도세를 추가 감면해 실거주를 보호할지, 보유 기간과 무관하게 과세를 강화할지 입장이 갈립니다.',
   '장기보유 감면 강화로 실거주 보호', -1,
   '과세 강화로 자산 형평성', 1,
   7, TRUE, 'v1'),

  ('housing_q8', 'housing', 'economy',
   '전국 빈집이 약 145만 호에 달하는 상황에서, 일정 기간 이상 비어있는 주택에 추가 과세하는 빈집세를 도입할지 의견이 갈립니다. 주택 활용을 강제할 수 있지만, 사정이 있어 비워둔 보유자에게 일률적 부담이 됩니다.',
   '빈집세 도입으로 주택 활용', 1,
   '도입 반대, 보유자 자율 존중', -1,
   8, TRUE, 'v1')
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

-- 사회 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('housing_q9', 'housing', 'social',
   '청년·신혼부부 주거 지원을 모든 해당 세대에 보편적으로 제공할지, 소득 기준에 따라 선별 지원할지 입장이 갈립니다.',
   '보편 지원으로 진입 장벽 완화', 1,
   '소득 선별로 자원 효율', -1,
   9, TRUE, 'v1'),

  ('housing_q10', 'housing', 'social',
   '1인 가구 비율 35%인 시대에 1인 가구의 주거권을 법적으로 보장(공공주택 의무 할당, 청약 가점 등)할지, 가구·결혼 단위 우선의 현행 정책을 유지할지 입장이 갈립니다.',
   '1인 가구 주거권 법적 보장', 1,
   '가구·결혼 단위 우선', -1,
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


-- ============================================================
-- 5. 외교·안보 심화팩 (security) — 10문항
-- ============================================================
-- 안보 7 / 경제 3
-- 반전: security_q9
-- 참고: q8(대중 반도체), q10(외국 자본 안보 심사)는 경제 축으로 매핑.
--      안보 토픽이지만 좌표 영향은 경제 시장-개입 차원.

-- 안보 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('security_q1', 'security', 'security',
   '한국이 부담하는 주한미군 방위비 분담금을 현행 수준 또는 증액해 동맹 신뢰를 유지할지, 한국 안보 기여도에 비해 과하다는 입장에서 축소·재협상할지 의견이 갈립니다.',
   '현행 수준 또는 증액', -1,
   '축소·재협상', 1,
   1, TRUE, 'v1'),

  ('security_q2', 'security', 'security',
   '북한·중국 위협 대응으로 사드(THAAD) 추가 배치를 검토할지, 중국과의 외교·경제 마찰을 우려해 신중할지 입장이 맞섭니다.',
   '추가 배치 검토', -1,
   '신중·외교 우선', 1,
   2, TRUE, 'v1'),

  ('security_q3', 'security', 'security',
   '전시작전권을 조속히 환수해 군사 주권을 회복할지, 한미 연합 작전 능력 검증 등 조건이 충족된 후 단계적으로 환수할지 의견이 갈립니다.',
   '조속한 환수', 1,
   '조건 충족 후 단계적 환수', -1,
   3, TRUE, 'v1'),

  ('security_q4', 'security', 'security',
   '식량·의료 등 대북 인도적 지원을 정치 상황과 분리해 재개할지, 비핵화 진전 없이는 제재 일관성을 유지할지 입장이 갈립니다.',
   '인도적 지원 재개', 1,
   '제재 일관성 유지', -1,
   4, TRUE, 'v1'),

  ('security_q5', 'security', 'security',
   '9·19 남북 군사합의의 효력을 복원해 군사 긴장 완화 조치를 재가동할지, 북한의 합의 위반을 이유로 효력 정지를 유지할지 입장이 갈립니다.',
   '효력 복원', 1,
   '효력 정지 유지', -1,
   5, TRUE, 'v1'),

  ('security_q6', 'security', 'security',
   '한일 GSOMIA(군사정보보호협정)를 유지·확대해 북핵 정보 공유를 강화할지, 과거사 미해결 상태에서 군사 협력은 신중히 할지 입장이 갈립니다.',
   '유지·확대', -1,
   '재검토·신중', 1,
   6, TRUE, 'v1'),

  ('security_q7', 'security', 'security',
   '강제동원 피해자 배상을 한국 정부·기업이 우선 변제하는 제3자 변제안으로 갈지, 일본 가해 기업의 직접 배상 원칙을 고수할지 입장이 맞섭니다.',
   '제3자 변제로 미래지향 협력', -1,
   '일본 직접 배상 원칙 고수', 1,
   7, TRUE, 'v1')
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

-- 경제 축 (안보-경제 교차)
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('security_q8', 'security', 'economy',
   '미국이 주도하는 대중 반도체·장비 수출 통제에 한국이 적극 동조할지, 최대 교역국인 중국과의 관계를 고려해 독자적 판단으로 갈지 입장이 갈립니다.',
   '미국 주도 통제 동조', -1,
   '독자 판단으로 중국 시장 보호', 1,
   8, TRUE, 'v1')
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

-- 안보 축 (반전 문항)
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('security_q9', 'security', 'security',
   '북한 SLBM 위협 대응으로 핵추진 잠수함을 도입할지 의견이 갈립니다. 미국 협력 없이 독자 추진할지(NPT·핵연료 확보 부담), 미국과의 협의 후 단계적으로 갈지의 차이입니다.',
   '독자 추진', 1,
   '미국 협력 후 단계적', -1,
   9, TRUE, 'v1')
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

-- 경제 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('security_q10', 'security', 'economy',
   '반도체·배터리 등 핵심 산업에 대한 외국 자본(특히 중국) 인수에 안보 심사를 강화할지, 자유 무역 원칙과 자본 시장 개방성을 우선할지 입장이 갈립니다.',
   '안보 심사 강화', 1,
   '자유 무역 원칙', -1,
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


-- ============================================================
-- 6. 젠더·가족팩 (gender) — 10문항
-- ============================================================
-- 사회 8 / 경제 1 / 정치제도 1
-- 반전: gender_q3, gender_q6, gender_q10

-- 사회 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('gender_q1', 'gender', 'social',
   '현행 남성 의무 징병제를 양성 평등 방향으로 개편할지, 신체 능력·국방 효율을 이유로 현행을 유지할지 입장이 갈립니다. 모병제·여성 의무복무·대체복무 확대 등 다양한 방향이 논의됩니다.',
   '양성 평등 방향 개편', 1,
   '현행 의무 징병 유지', -1,
   1, TRUE, 'v1')
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

-- 정치제도 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('gender_q2', 'gender', 'institution',
   '여성가족부의 기능과 위상을 현행대로 유지·강화할지, 다른 부처(보건복지·인권 등)와 통합·재편할지 입장이 맞섭니다.',
   '현행 존치·기능 유지', -1,
   '통합·재편', 1,
   2, TRUE, 'v1')
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

-- 사회 축 (반전 포함)
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('gender_q3', 'gender', 'social',
   '2019년 헌법불합치 결정 이후 낙태 관련 입법 공백이 이어지고 있습니다. 임신 주수에 따른 제한 등 일정한 기준을 두자는 입장과, 여성의 자기결정권을 우선해 완전 비범죄화하자는 입장이 맞섭니다.',
   '주수 제한 등 기준 도입', -1,
   '완전 비범죄화', 1,
   3, TRUE, 'v1'),

  ('gender_q4', 'gender', 'social',
   '동성 커플에게 결혼이 아닌 형태로 의료·상속·동거 등 생활 동반자 권리를 법적으로 보장하자는 생활동반자법 논의가 있습니다. 도입할지, 현행 가족 제도 안에서 다룰지 입장이 갈립니다.',
   '생활동반자법 도입', 1,
   '현행 가족법 안에서', -1,
   4, TRUE, 'v1')
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

-- 경제 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('gender_q5', 'gender', 'economy',
   '한국의 성별 임금 격차는 OECD 회원국 중 최상위 수준입니다. 기업의 성별 임금 격차를 의무 공시·시정 명령 대상으로 할지, 시장과 기업 자율에 맡길지 입장이 갈립니다.',
   '의무 공시·시정 명령', 1,
   '시장·기업 자율', -1,
   5, TRUE, 'v1')
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

-- 사회 축
INSERT INTO balance_game_questions
  (id, pack_id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score, display_order, is_active, mapping_version)
VALUES
  ('gender_q6', 'gender', 'social',
   '성범죄 무고로 인한 피해 사례가 사회 문제로 제기되면서, 무고죄 처벌을 강화할지 의견이 갈립니다. 무고 피해자 보호 측면과, 처벌 강화가 실제 피해자의 신고를 위축시킬 수 있다는 측면이 맞섭니다.',
   '무고죄 처벌 강화', -1,
   '현행 유지로 신고 위축 방지', 1,
   6, TRUE, 'v1'),

  ('gender_q7', 'gender', 'social',
   '저출생 시대에 출산·육아를 사회적 책임으로 보고 정부가 적극 정책 개입할지, 개인의 선택과 자기결정 영역으로 보고 자율을 존중할지 입장이 갈립니다.',
   '개인 선택 존중', 1,
   '사회적 책임으로 적극 개입', -1,
   7, TRUE, 'v1'),

  ('gender_q8', 'gender', 'social',
   '비혼 동거·1인 가구·동성 커플 등 다양한 가족 형태를 법적으로 인정·지원할지, 혼인·혈연 중심의 전통 가족을 우선 보호할지 의견이 갈립니다.',
   '다양한 형태 법적 인정', 1,
   '전통 가족 우선 보호', -1,
   8, TRUE, 'v1'),

  ('gender_q9', 'gender', 'social',
   '학교에서의 성평등·성교육을 공교육 차원에서 의무화할지, 가정과 학교의 자율에 맡길지 입장이 갈립니다. 교육 내용에 대한 사회적 합의 부족도 주요 쟁점입니다.',
   '공교육 의무화', 1,
   '가정·학교 자율', -1,
   9, TRUE, 'v1'),

  ('gender_q10', 'gender', 'social',
   '한국 사회의 젠더 갈등을 어떻게 보는가에 따라 정책 방향이 갈립니다. 한쪽은 남성에 대한 역차별·과도한 정책 우대를 우려하고, 다른 쪽은 여전한 구조적 차별을 지적합니다.',
   '역차별·과도한 우대 우려', -1,
   '구조적 차별 지속 인정', 1,
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


-- ============================================================
-- 7. 검증 쿼리
-- ============================================================

-- 게임팩별 문항 수 확인
-- SELECT pack_id, COUNT(*) FROM balance_game_questions WHERE mapping_version='v1' GROUP BY pack_id ORDER BY pack_id;
-- 기대: gender 10, general 20, housing 10, labor 10, security 10

-- 게임팩별 축 분포 확인
-- SELECT pack_id, axis, COUNT(*) FROM balance_game_questions WHERE mapping_version='v1' GROUP BY pack_id, axis ORDER BY pack_id, axis;

-- 반전 문항 확인 (option_a_score < 0 인 문항)
-- SELECT pack_id, id, axis, option_a_score FROM balance_game_questions
--   WHERE mapping_version='v1' AND option_a_score < 0 ORDER BY pack_id, display_order;

COMMIT;
