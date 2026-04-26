# 법안-축 매핑 가이드라인 v1

> ✅ **v1 완료** (2026-04-26): 50건 1차 매핑 → 사용자 1라운드 검토 → 48건 (`etc/ddl/seeds/bill_axis_mapping_v1.sql`). 다음 라운드(v2) 작업 시 본 가이드 재사용.
>
> 의원 4축 좌표 계산을 위한 법안 매핑 작업 지침서.
> 대상 작업자: CLI (1차 매핑) + 사용자 (검토 시 참조).
>
> 작성일: 2026-04-26
> 의존: BALANCEGAME.md §3 (4축 정의), §11 (DB 스키마)
> 매핑 정책: 비공개 (UI 노출 X) — 부담은 작지만 일관성은 중요
> 검토 결과: [BILL_AXIS_MAPPING_v1_REVIEW.md](./BILL_AXIS_MAPPING_v1_REVIEW.md)
> 산출물 의존 작업: `batch/calcPoliticianAxis.js` (의원 좌표 산출 — 의원 294/295명, institution std 0.621)

---

## 1. 목적과 범위

### 왜 이 작업이 필요한가

밸런스 게임의 D 레이어 — 의원 카드 거리 배지(`🎯 0.7`), 홈 "당신과 결 비슷한 의원의 법안" 탭, 법안 상세 좌표 정보 — 가 작동하려면 **의원 4축 좌표가 사전 계산**되어야 합니다.

의원 좌표 계산 흐름:
```
법안 X에 의원 A가 찬성 표결 (DB에 있음)
       ↓
법안 X는 어느 축에 매핑되어 있는가? (← 이 작업이 채움)
       ↓
의원 A의 해당 축 점수 ±1 누적
       ↓
모든 매핑된 법안 × 모든 의원 → politician_axis_score 갱신
```

**즉 매핑된 법안의 표결만 의원 좌표 계산에 기여**합니다. 안 매핑된 법안은 무시.

### 작업 분량

- **목표: 50건** (16,889건 중 0.3%)
- **축당 12~13건씩 균형** (4축 × 12.5)
- 한 번 작업으로 의원 좌표 일차 계산 가능
- 추후 새 가결 법안 발생 시 비정기 추가 매핑

### 비공개 매핑

이 매핑은 UI에 노출되지 않습니다 (질문 매핑은 매핑 페이지에 공개되지만 법안 매핑은 비공개). 따라서:
- `notes` 칸은 운영자 본인 참고용 — 자유롭게
- 다만 **일관성**은 중요 — 비공개여도 의원 좌표 정밀도가 매핑 품질에 직결

---

## 2. 후보 법안 추출 기준

### SQL 쿼리 (CLI 실행)

```sql
-- 매핑 후보 200건 추출
-- 조건: 가결 + 본회의 표결 있음 + 표결 분포 갈림 + 4축 분류 가능
SELECT
  b.bill_id,
  b.bill_name,
  b.propose_dt,
  b.proc_result_cd,
  b.committee_name,
  b.bill_topic_cd,           -- 기존 주제 분류 (참고용)
  ba.category_main,           -- v4.1 카테고리 (있으면 매핑 보조)
  ba.category_sub,
  ba.summary AS ai_summary,   -- AI 분석 한 줄 요약 (있으면)
  -- 표결 통계
  vs.agree_count,
  vs.disagree_count,
  vs.abstain_count,
  vs.agree_count::float / NULLIF(vs.agree_count + vs.disagree_count, 0) AS agree_rate
FROM bills b
JOIN (
  SELECT bill_id,
         SUM(CASE WHEN result_vote_mod = '찬성' THEN 1 ELSE 0 END) AS agree_count,
         SUM(CASE WHEN result_vote_mod = '반대' THEN 1 ELSE 0 END) AS disagree_count,
         SUM(CASE WHEN result_vote_mod = '기권' THEN 1 ELSE 0 END) AS abstain_count
  FROM votes
  GROUP BY bill_id
  HAVING COUNT(*) > 100   -- 표결 참여 100명 이상
) vs ON b.bill_id = vs.bill_id
LEFT JOIN bill_ai_analysis ba ON b.bill_id = ba.bill_id
WHERE b.proc_result_cd = '원안가결' OR b.proc_result_cd = '수정가결'
  AND vs.agree_count + vs.disagree_count > 100   -- 의미 있는 표결
  -- 변별력: 만장일치 제외 (찬성률 95% 이상은 변별력 없음)
  -- 압도적 부결도 제외 (찬성률 5% 이하)
  AND vs.agree_count::float / NULLIF(vs.agree_count + vs.disagree_count, 0) BETWEEN 0.05 AND 0.95
ORDER BY 
  -- 분석된 법안 우선 (컨텍스트 빠르게 잡힘)
  CASE WHEN ba.bill_id IS NOT NULL THEN 0 ELSE 1 END,
  -- 표결 분포가 갈릴수록 우선 (찬성률이 50%에 가까울수록)
  ABS(vs.agree_count::float / NULLIF(vs.agree_count + vs.disagree_count, 0) - 0.5),
  b.propose_dt DESC
LIMIT 200;
```

이 200건이 후보군. 여기서 50건 선별.

### 50건 선별 기준 (CLI 판단)

200건을 다 매핑할 필요 없이, 다음 우선순위로 50건만:

1. **4축 균형 우선** — 경제 12~13 / 사회 12~13 / 안보 12~13 / 정치제도 12~13
2. **변별력 큰 법안 우선** — 찬성률 30~70% (가장 갈린 표결)
3. **위원회 다양성 우선** — 같은 위원회 법안만 쏠리지 않게
4. **AI 분석된 법안 우선** — 컨텍스트 빠르게 잡힘. 50건 중 절반 이상이면 좋음

### 빼야 할 법안

다음은 매핑 후보에서 **제외**:
- **만장일치 가결** (찬성률 95% 이상) — 의원 변별 못 함
- **4축 밖 이슈** — 환경·기후, 의료 자체 (4축으로 깔끔하게 안 떨어지면 매핑 안 함)
- **절차적·행정적 법안** — 부처 명칭 변경, 부칙 정비 등
- **모호한 법안** — 어느 축인지 1분 이상 고민되면 빼기 ("매핑 안 함"이 안전)

---

## 3. 4축 정의 (다시 한번)

BALANCEGAME §3 인용. 매핑 시 이 정의에서 흔들리지 않을 것.

| 축 | 양 끝 (왼쪽 ↔ 오른쪽) | 한국 정치 변별 사례 |
|---|---|---|
| **economy** | 시장 자율 ↔ 정부 개입 | 최저임금, 부동산 세제, 대기업 규제 |
| **social** | 전통·질서 ↔ 자율·다양성 | 동성혼, 차별금지법, 사형제 |
| **security** | 동맹·대북강경 ↔ 자주·대북대화 | 한미일, 사드, 9·19 합의 |
| **institution** | 안정·기존질서 ↔ 개혁·재편 | 검찰개혁, 선관위, 연동형비례 |

### 매핑 방향 약속 (BALANCEGAME §11 DDL과 정합)

`bill_axis_mapping` 테이블 컬럼:
- `axis` — 'economy' | 'social' | 'security' | 'institution'
- `agree_score` — 찬성 표결이 어느 방향인지 (-1 ~ +1)
- `disagree_score` — 반대 표결이 어느 방향인지 (보통 agree_score의 부호 반전)

**부호 약속**:
- `economy`: -1 = 시장, +1 = 개입
- `social`: -1 = 전통, +1 = 자율
- `security`: -1 = 동맹·강경, +1 = 자주·대화
- `institution`: -1 = 안정·기존, +1 = 개혁·재편

종합팩 20문항 매핑 (`balance_game_seed_v1.sql`)과 같은 약속.

---

## 4. 매핑 결정 단계 (1건당 ~2분)

각 법안에 대해:

### 단계 1: 법안 정보 파악 (30초)
- `bill_name`, `committee_name`, `ai_summary` (있으면) 읽기
- AI 분석된 경우 `category_main` 참고
- 본문이 짧으면 의안정보시스템 링크로 제안이유 빠르게 확인

### 단계 2: 4축 매핑 (60초)
- "이 법안의 본질은 어느 축의 어느 입장인가?" 자문
- 두 축 이상 걸친다 싶으면 **주축 1개**만 선택 (가장 강한 영향)
- 4축에 안 맞으면 **매핑 안 함** (CSV에서 빼거나 axis=NULL로 표시)

### 단계 3: 방향 결정 (30초)
- "찬성 표결자는 어느 방향 입장인가?"
- 보통 `agree_score`는 ±1, `disagree_score`는 부호 반전
- 약한 매핑은 weight 0.5 (모호하지만 매핑은 가능)
- 강한 매핑은 weight 1.0 (명확)

### 단계 4: 노트 작성 (선택)
- `notes`에 한 줄 — "왜 이 매핑인가"
- 본인 미래 검토용. 비공개라 자유롭게.

---

## 5. 매핑 예시 (학습용)

### 예시 A — 명확한 경제 축 (시장)

```
법안: 부동산 양도소득세 감면 특례법 일부개정
ai_summary: "1주택자 양도세 추가 감면, 거주 기간 요건 완화"
committee_name: 기획재정위원회
agree_rate: 0.62 (적당히 갈림)

매핑:
  axis = 'economy'
  agree_score = -1   (찬성 = 세 부담 완화 = 시장 방향)
  disagree_score = +1
  weight = 1.0
  notes = "양도세 감면은 시장 자율 강화. 분배 효과는 부차적."
```

### 예시 B — 명확한 사회·문화 축 (자율)

```
법안: 차별금지법 (제정안)
agree_rate: 0.51 (거의 정확히 갈림)

매핑:
  axis = 'social'
  agree_score = +1   (찬성 = 자율·다양성 방향)
  disagree_score = -1
  weight = 1.0
  notes = "소수자 권리 vs 종교·사상 자유 표현. 사회 문화 축 핵심."
```

### 예시 C — 안보 축

```
법안: 한미일 안보협력 강화 결의안
agree_rate: 0.55

매핑:
  axis = 'security'
  agree_score = -1   (찬성 = 동맹 강화 방향)
  disagree_score = +1
  weight = 1.0
  notes = "한미일 협력 = 동맹 축 명확."
```

### 예시 D — 정치제도 축

```
법안: 검찰청법 개정 (수사권 조정)
agree_rate: 0.50

매핑:
  axis = 'institution'
  agree_score = +1   (찬성 = 권력 분산·개혁)
  disagree_score = -1
  weight = 1.0
  notes = "검찰 권한 분산 = 정치제도 개혁 방향."
```

### 예시 E — 약한 매핑 (weight 0.5)

```
법안: 공공기관 운영 효율화 특별법
ai_summary: "공공기관 인력·예산 효율화"
committee_name: 기획재정위원회

매핑:
  axis = 'economy'
  agree_score = -1   (찬성 = 효율화·민간화 = 시장 약한 방향)
  disagree_score = +1
  weight = 0.5      ← 약한 매핑
  notes = "민영화는 아니고 효율화. 시장 방향이지만 약함."
```

### 예시 F — 매핑 안 함 (4축 밖)

```
법안: 가축전염병 예방법 일부개정
ai_summary: "AI 발생 시 살처분 보상금 인상"

매핑: 안 함 (insert 안 함)
notes: "농업·축산 정책. 4축 밖. 변별력은 있을 수 있으나 좌표 노이즈."
```

### 예시 G — 매핑 안 함 (만장일치)

```
법안: 위안부 기림일 지정 결의안
agree_rate: 0.98

매핑: 안 함
notes: "만장일치 통과. 의원 변별 불가."
```

---

## 6. 표현 균형 — 사용자 검토 시 참조

법안 매핑은 비공개라 표현 균형이 질문 매핑만큼 중요하지 않지만, **`notes` 칸이 미래 검토에 영향**을 미칠 수 있어요. 다음 단어 회피:

- ❌ "보수적" / "진보적" — 진영 단어
- ❌ "○○당 지지 법안" — 정당 언급
- ❌ "옳다" / "그르다" — 가치 판단
- ✅ "시장 방향" / "개입 방향" — 축 정의 어휘
- ✅ "약한 매핑" / "강한 매핑" — 매핑 강도

`notes`는 검토 시 사용자가 보고 "이 매핑이 적절한가" 판단하는 자료. 진영 어휘가 들어가면 검토 자체가 편향됨.

---

## 7. 출력 형식 (CLI → 사용자)

### A. INSERT SQL (DB 임포트용)

```sql
-- bill_axis_mapping 시드 (v1, AI 1차 매핑 50건)
INSERT INTO bill_axis_mapping
  (bill_id, axis, agree_score, disagree_score, weight, mapping_version, mapped_by, notes)
VALUES
  ('PRC_XXX', 'economy', -1, 1, 1.0, 'v1', 'ai_v1', '양도세 감면 = 시장 방향'),
  ('PRC_YYY', 'social',  1, -1, 1.0, 'v1', 'ai_v1', '차별금지법 = 자율 방향'),
  ...
ON CONFLICT (bill_id) DO UPDATE SET
  axis = EXCLUDED.axis,
  agree_score = EXCLUDED.agree_score,
  disagree_score = EXCLUDED.disagree_score,
  weight = EXCLUDED.weight,
  mapping_version = EXCLUDED.mapping_version,
  notes = EXCLUDED.notes,
  updated_at = NOW();
```

### B. 검토용 요약 (사용자 둘러보기)

CSV 또는 마크다운 표 형식:

```
| bill_id | bill_name | axis | direction | weight | notes |
|---------|-----------|------|-----------|--------|-------|
| PRC_XXX | 양도세 감면 특례 | economy | 시장 | 1.0 | 양도세 감면 = 시장 |
| PRC_YYY | 차별금지법 | social | 자율 | 1.0 | 소수자 권리 |
| ... |
```

### C. 통계 (검증용)

```
축별 분포:
  economy: 13건
  social: 12건
  security: 13건
  institution: 12건
  → 총 50건, 균형 OK

위원회별 분포:
  기획재정위: 8건
  법사위: 6건
  외통위: 7건
  ...

weight 분포:
  1.0: 38건 (강한 매핑)
  0.5: 12건 (약한 매핑)
```

---

## 8. 검증 체크리스트 (CLI 작업 끝난 후)

CLI가 매핑 끝내면 다음 자체 검증 후 사용자에게 결과 공유:

- [ ] 50건 매핑 완료
- [ ] 4축 분포 12~13건씩 균형
- [ ] weight 1.0 vs 0.5 합리적 (약한 매핑이 너무 많지 않은지, 30% 이하)
- [ ] 위원회 한쪽 쏠림 없음
- [ ] 종합팩 매핑(`balance_game_seed_v1.sql`)과 부호 약속 일치
- [ ] 만장일치·4축 밖 법안이 잘못 들어가지 않았는지
- [ ] notes 칸에 진영 단어 없는지
- [ ] AI 분석된 법안 비율 50% 이상 (컨텍스트 정밀도)

---

## 9. 사용자 검토 가이드

CLI 결과 받은 후, 사용자는 다음 방식으로 둘러보기:

1. **B. 검토용 요약** 표 받기 (50줄)
2. 그냥 쭉 읽으면서 위화감 있는 거 짚기 — 검토 의무 X, 둘러보기
3. "이 매핑 이상한데?" 싶은 거 있으면 사용자가 표시
4. CLI 또는 Claude가 그 부분만 다시 검토

50건 둘러보기에 10~15분. 부담 없음.

---

## 10. 향후 갱신

- 새 가결 법안 발생 → 분기에 한 번씩 추가 매핑 (10~20건)
- 매핑 변경 시 `mapping_version` v2로 갱신
- 의원 좌표는 `mapping_version`별로 별도 계산 → 과거 좌표 보존

---

*이 가이드라인은 베타 출시 전 1회 매핑 작업의 기준선입니다.*
*베타 운영하면서 발견된 매핑 결함은 v2 갱신 때 한 번에 반영하세요.*
