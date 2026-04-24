# 정치 바로미터 — 비전 & 로드맵
> 프로젝트 철학·미구현 기획·우선순위를 담습니다.
> 현재 기술 상태: [CLAUDE.md](./CLAUDE.md)
> 과거 작업 내역: [CHANGELOG.md](./CHANGELOG.md)

---

## 전체 그림 — 세 개의 서비스, 하나의 생태계

```
정치 바로미터          밸런스 게임              Venn
(커뮤니티 + 유저 확보) → (가치관 카드 엔진)  → (관계 탐색 SNS)
```

**추천 오픈 순서**: 정치 바로미터 → 밸런스 게임 → Venn

---

## 다음 작업 우선순위

### 베타 오픈 전 필수
1. **AI 법안 분석 배치 스크립트 구현** (`batch/analyzeBills.js`)
   - Haiku + v4 프롬프트 ([ANALYSIS.md](./ANALYSIS.md))
   - JSON mode + 후처리 파이프라인 (오타·메타 섹션 제거)
   - 가결 490건 먼저 → 전체 16,817건 확장
   - 예상 비용: $7 이내
2. 시민 찬반 위젯 디자인 중립화
   - 초록/빨강 → 골드 계열 대비 색으로 전환
   - 정당색 회피 원칙 유지
3. 여야 협력(bipartisan) 탭 실데이터 구현
4. 모바일 반응형 점검 (nav 로고는 완료, 나머지 페이지 필요)
5. footer 링크 연결 (`/privacy` 등 `#` 처리된 것들)
6. Google AdSense 신청
7. ~~OG 태그 적용 (og-image.png → layout.ejs)~~ ✅ 2026-04-23 완료
8. ~~법안 상세 페이지 UI 개선 (AI 분석 5-Zone 통합)~~ ✅ 2026-04-24 완료

### 베타 오픈 후 — 1순위
9. **AI 분석 Zone 5 추가** — 참고 맥락(`context`) · 분석 한계(`limitations`) 접힘 표시 + Zone 4 "더 알아보기" 버튼 부활
10. 국회 X레이 메뉴 (시각화 5종)
    - ① 발의왕 vs 입법왕 산점도 ← 최우선
    - ② 정당별 관심 위원회 히트맵
    - ③ 여야 표결 온도차 TOP10
    - ④ 당론 이탈 의원 순위
    - ⑤ 법안 생존율 깔때기
11. **의원 AI 분석 기능** — [ANALYSIS.md](./ANALYSIS.md) 원칙 재사용 (의원 활동 프로파일·표결 패턴·대표발의 성향)
12. 정치 성향 밸런스 게임 + 밸런스게임 서비스 링크
13. 재화 시스템 (credits 컬럼 + credit_logs 테이블)
14. 의원 별점 → 재화 소비로 전환

### 베타 오픈 후 — 2순위
15. 악성 댓글 실시간 감지 + 삼진아웃
16. 의원 상세 개요 분석 탭 오픈
17. 커뮤니티 고도화 (신고·검색·정렬)
18. 실시간 알림
19. `bill_topic_cd` 컬럼 DB 드롭

---

## 미구현 기획 1: 재화 시스템

### 재화명 후보
"표" (한 표라는 의미, 서비스 철학과 연결) — 확정 전

### 지급
- 가입 시 무료 5표 지급
- 이후 구매 또는 활동으로 획득

### 소비
- 의원 별점 평가 → 1표 (무분별 평가 방지)
- 법안 찬반 투표 → 무료 (시민 참여 데이터 최대 수집)
- AI 성향 분석 → 3표
- AI 법안 분석 → 2표
- 댓글 차단 해제 (삼진아웃) → 10표

### 타 서비스 연동
일단 정치 바로미터 독립 재화로 운영.
밸런스게임 + Venn 모두 오픈되면 통합 고려.

### DB (예정)
```sql
ALTER TABLE users ADD COLUMN credits SMALLINT NOT NULL DEFAULT 5;

CREATE TABLE credit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(user_id),
  amount     SMALLINT NOT NULL, -- 양수=충전, 음수=사용
  reason     VARCHAR(50) NOT NULL,
  -- 'signup_bonus'|'rating'|'ai_analysis'|'purchase'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 미구현 기획 2: 악성 댓글 시스템

### 방식
실시간 감지 (배치 X) — 댓글 작성/수정 시 서버에서 즉시 매칭

### 처리
- 금칙어 감지 시 저장 거부 + "금칙어 포함" 메시지 (A방식)
- strikes 차감은 우회 작성 시
- 삼진아웃: `strikes >= 3` → 댓글 권한 차단

### 차단 해제
- 결제 (즉시 해제, 10표)
- 30일 경과 후 자동 해제 (무료)

### DB (예정)
```sql
ALTER TABLE users ADD COLUMN comment_strikes SMALLINT NOT NULL DEFAULT 0;

CREATE TABLE banned_keywords (
  id         SERIAL PRIMARY KEY,
  keyword    VARCHAR(100) NOT NULL UNIQUE,
  severity   SMALLINT NOT NULL DEFAULT 1, -- 1=경고, 2=즉시차단
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 미구현 기획 3: 정치 성향 밸런스 게임

### 개념
정치 바로미터 내 미니 콘텐츠.
- 실제 법안 기반 10~15문항 찬반 선택
- → AI가 성향 분석 (진보/보수 스펙트럼 + 관심 분야)
- → 비슷한 성향 의원 TOP3 추천
- → 관련 법안 보러가기
- → "더 알고 싶다면 밸런스게임 서비스 바로가기" 링크

### 수익 연결
- AI 성향 분석 결과 → 3표 소비
- 가입 후 5표 무료 → 1회 무료 체험 가능

### 데이터 활용
- 이용자 성향 분포 통계 → 국회 X레이 콘텐츠
- 나중에 Venn 매칭 데이터로 활용 가능

---

## 서비스 2: 밸런스 게임 (The Balance)
- URL: https://the-playground-khaki.vercel.app
- 기술: Next.js 14 + Supabase + TypeScript + Tailwind + Vercel
- 현재 문제: "왜 해야 하지?" → Venn과 연결하면 해결
- 콘텐츠: 50개 가치관 질문 (가치관 카드 생성 → Venn 프로필)

---

## 서비스 3: Venn (기획 완료)
- 슬로건: "Where your circles overlap"
- 핵심: 관계를 축소시키는 SNS, 연결의 희소성이 관계의 가치를 만든다
- 메커니즘: 익명 가입 → 공통분모 매칭 → 스무고개 접근 → 승인/거부 → 진짜 연결
- 콜드스타트: 정치 바로미터 유저 → Venn 베타 우선 초대
