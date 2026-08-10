# 당말사 — 비전 & 로드맵
> 프로젝트 철학·미구현 기획·우선순위를 담습니다.
> 현재 기술 상태: [CLAUDE.md](./CLAUDE.md)
> 과거 작업 내역: [CHANGELOG.md](./CHANGELOG.md)

---

## 전체 그림 — 세 개의 서비스, 하나의 생태계

```
당말사                 밸런스 게임              Venn
(커뮤니티 + 유저 확보) → (가치관 카드 엔진)  → (관계 탐색 SNS)
```

**추천 오픈 순서**: 당말사 → 밸런스 게임 → Venn

---

## 다음 작업 우선순위

### 베타 오픈 전 필수
1. ~~**AI 법안 분석 배치 스크립트 구현**~~ ✅ 2026-04-25 완료 (`batch/syncBillAiAnalysis.js` v4 → 04-26 v4.1 카테고리 2-tier). 다음 운영 액션:
   - 가결 490건 본격 분석 (~$8.4) — 사용자 결정 후 진행
   - 분석 요청 우선순위 큐 (`/bill?has_analysis=N&request_status=any&sort=requested`) 주기적 처리
2. ~~국민 찬반 위젯 디자인 중립화~~ ✅ 2026-04-26 완료 (`--vote-pro` 슬레이트 / `--vote-con` 모카, 등명도 저채도 두 hue. 본회의 표결 시각화는 객관 데이터라 `--green/--red` 유지)
3. **22대 역대 의원 데이터 보강** — `politicians` 테이블에 중도 퇴임 의원 포함
   - 현재 상태: `syncPoliticians.js` 가 현직 API 기반 → 현직 295명만. 22대 임기 중 사직·당선무효·사망·승계 등으로 퇴임한 ~11명이 누락
   - 증상: 본회의 표결 리스트·발의자 카드에서 해당 의원 이름·정당·사진 공란, LEFT JOIN miss 로 `mona_cd` 원본이 노출될 뻔함 (2026-04-24 UI fallback 으로 "(퇴임)" 표기는 처리)
   - 해결: 열린국회 **"역대 국회의원 인적사항" API** (22대 한정 필터) 호출로 전환, `politicians` 에 `is_active BOOLEAN` 컬럼 신설해 현직/전직 구분
   - 퇴임 의원 상세 페이지는 "22대 재임(YYYY.MM.DD ~ YYYY.MM.DD)" 표기 + 표결·발의 이력은 그대로 노출
4. 여야 협력(bipartisan) 탭 실데이터 구현
5. 모바일 반응형 점검 (nav 로고는 완료, 나머지 페이지 필요)
6. footer 링크 연결 (`/privacy` 등 `#` 처리된 것들)
7. Google AdSense 신청
8. ~~OG 태그 적용 (og-image.png → layout.ejs)~~ ✅ 2026-04-23 완료
9. ~~법안 상세 페이지 UI 개선 (AI 분석 5-Zone 통합)~~ ✅ 2026-04-24 완료
10. ~~AI 분석 표시 시스템 + 분석 요청 시스템~~ ✅ 2026-04-25 완료 (진행률 배너, 통합 필터, 카드 배지·요약, 미분석 시 요청 위젯, 마이페이지)
11. **AI 분석 자동 트리거** — 임계값(5명) 도달 시 cron 또는 hook 으로 자동 분석. 현재는 운영자가 수동으로 `--bill-id` 실행. 자동화 위치는 `batch/syncBillAiAnalysis.js` 의 `fetchTargets` 에 "request_count >= threshold AND a.bill_id IS NULL" 분기 추가
12. **prompt cache 활성화** — 현재 system prompt(~3,300 tok)가 Haiku 4.5 임계값(~4,096) 미달로 캐시 안 들어감. 예시·금지표현 추가로 4,500+ 토큰까지 늘리면 자동 활성. 절감 효과 = 1건당 cache_read $0.0033 (input × 0.10) ≈ -20%
13. **legacy `category` 컬럼 DROP** — v4.1 안정화 1주 후 (`bill_ai_analysis.category` 와 `bills.bill_topic_cd` 둘 다)
14. **정치 성향 밸런스 게임** — [BALANCEGAME.md](./BALANCEGAME.md) / [UI_BALANCEGAME.md](./UI_BALANCEGAME.md) 참조
    - ✅ 2026-04-26 (1~4차) — 게임 5단계 완성: 누적 모델 + 게임팩 컬렉션 + 펼침 다이아몬드 + 비교 + 연결, `/auth/welcome` 환영 페이지, 종합팩 'general' 20문항 + 주제팩 4종 (60문항), `bill_axis_mapping_v1` 48건, `batch/calcGroupAxisAvg.js`. 자세한 내역은 [CHANGELOG.md](./CHANGELOG.md)
    - ✅ 2026-04-26 (5~9차) — 의원 좌표 + D 레이어 본체:
      - `batch/calcPoliticianAxis.js` 의원 294/295명 4축 좌표 산출 (institution std 0.621 변별력 큼)
      - middleware `userAxis` + `userDistanceQuartiles` 주입, `getListWithStats.sql`/`getDetail.sql` LEFT JOIN
      - 카드 텍스트 통일 (`"나의 성향 진단과 N% 일치"`, 모든 의원 동일톤) — 4단계 반복 정련 끝에 도달
      - **일치도 필터·정렬** (의원 페이지 본체): 5옵션 필터 + 일치도 높은 순/낮은 순 정렬 + URL 영속화. 안정 유저 검증 — 60%↑ 9명 전부 국힘 / 50%↓ 231명. 정반대 의원 발견 가치 ✓
    - ✅ 2026-04-26 (10~13차) — 의원 상세 "당신과의 비교" 펼침 컴포넌트 (객관 착시 방지):
      - 4축 비교 다이아몬드 (사용자 골드 + 의원 회색 점선) + 축별 해석 4줄 — 카드 % 가 어떻게 나왔는지 분해 (BALANCEGAME §1 "객관 아닌 투명")
      - 위치: KPI 행 바로 아래. 헤더 + 펼침 바디 단일 컴포넌트(`bg-vs-collapsible`). 첫 진입 자동 펼침
      - 레이아웃: flex column 가운데 정렬 (다이아몬드 위 / border-top / 축별 해석 아래). 헤더에 일치도 % 가 있어 바디 결론 박스 제거
      - 일치도 공식 분모 2 → **1.5** (실측 [0.61, 1.49] 보정. 카드 배지에도 동일 적용. 직관 정합)
      - 강도 4단계 × 방향 (`같은 방향 (둘 다 SIDE 쪽) / 반대 방향 / 한쪽 중도 근처`) · 좌표 수치는 SVG `<title>` 호버 툴팁
      - Fallback: 미완료 → "진단하러 가기 →" / 미산출 → "분석 데이터 부족" (둘 다 펼침 비활성)
    - ⬜ 홈 "결 비슷한 의원의 법안" 탭 (의원 좌표 + `bills.mona_cd` 정렬)
    - ⬜ 법안 상세 Zone 4 끝 D 레이어 1줄 ("당신과 결 비슷한 의원이 가장 많이 찬성/반대했어요")
    - ⬜ 단계 5 connect "비슷한 의원 TOP 3" (의원 좌표 의존)
    - ⬜ 주제 게임팩 4개 매핑 점검 + 게임팩 컬렉션 페이지에서 활성
    - ⬜ 마이페이지 카드 갤러리 (Phase 3+ — 시간순 카드 보존)
    - ⬜ v2 매핑: security 추가 매핑 (5건 → 10건+) · 변별력 큰 부결/이탈 법안 economy/social 보강

### 🔧 오픈 당일 인프라 체크리스트 (2026-08-04 크론 배포 시 도출)
> 기능이 아니라 **운영 설정** 항목. 오픈 전날 이 섹션만 훑고 넘어가면 됨.
> 배경·수치 근거는 [CHANGELOG.md](./CHANGELOG.md) 2026-08-04 항목 참조.

- [ ] **`BASE_URL` 환경변수 확인** ⚠️ 오픈 전 필수 — 없으면 SNS 공유가 깨진다
  - `layout.ejs` 의 `og:url`/`og:image`/`twitter:image` 가 `http://localhost:3000` 으로 폴백 → 카카오톡·트위터 썸네일 미표시
  - `config/passport.js` 의 OAuth `callbackURL` 도 상대경로가 됨
  - 값: `BASE_URL=https://politics-production.up.railway.app` (자체 도메인 연결 시 그 도메인으로 교체)
  - **자체 도메인 붙일 때 같이 바꿔야 함** — AdSense 때문에 도메인 구입 예정이므로 잊기 쉬움
- [ ] **`NODE_ENV=production` 확인** — `app.js` 의 세션 쿠키 `secure` 플래그 조건. 없으면 로그인 쿠키에 Secure 가 안 붙음
- [ ] **`TZ=Asia/Seoul` 확인 (웹·크론 둘 다)** — 날짜가 프로세스 타임존을 타는 코드에 대한 안전망. 규칙은 [CLAUDE.md](./CLAUDE.md) "날짜·시간 처리 규칙"
- [ ] **Railway Usage limits — COMPUTE Hard limit 을 $10 → $20~30 으로 상향** ⚠️ 최우선
  - Hard limit 은 "여기 닿으면 **전 서비스 정지**" 선이다. 웹까지 내려간다
  - 오픈 전엔 방문자가 없어 $10 이 안전하지만, 오픈 후엔 **트래픽이 몰린 날 = 사이트가 죽는 날**이 될 수 있다
  - 근거: Hobby 상한(8 vCPU/8 GB) 풀가동 폭주가 하루 약 $8. 상향해도 폭주는 2~3일 내 차단됨
  - Email alert 은 $5 유지 (포함 크레딧 소진 시점 = 실과금 시작 신호)
- [ ] **웹 서비스 Replica Limits 재확인** — 현재 8 vCPU / 8 GB. **낮추지 말 것**
  - 크론(2 vCPU/2 GB)과 달리 웹은 상한에 닿으면 OOM 으로 사이트가 죽는다. 크론은 실패해도 다음날 재시도로 끝
  - 상한은 예약이 아니라 천장이라 높게 둬도 요금이 늘지 않음. 비용 방어는 위의 Usage limits 가 담당
- [ ] **`bill_axis_mapping` 좌표 미산출 의원 재확인** — 2026-08-04 기준 현직 299명 중 **15명** 이 표결 0건이라 일치도 미표시
  - 김남국·송영길·박지원·이광재·한동훈·이진숙 등 최근 보궐·재보선 유입 의원. 표결이 쌓이면 자동 해소되지만, 유명 이름이 비어 보이는 게 오픈 시점에 걸릴 수 있음
  - 확인: `SELECT count(*) FROM politicians p LEFT JOIN politician_axis_score s ON s.mona_cd=p.mona_cd AND s.mapping_version='v1' WHERE p.active_yn AND s.mona_cd IS NULL`
- [ ] **정적 자산 캐시 TTL 상향 검토** — 현재 `app.js` 의 `express.static(..., { maxAge: '1h' })`
  - 파일명에 해시가 없어(`main.css`/`interactions.js`) 1시간으로 묶어둔 상태. `layout.ejs` 링크에 `?v=` 버전 쿼리를 붙이면 1년으로 올려도 안전
- [ ] **`batch_runs` 이상 감지 습관화** — `status='running'` 이 오래 남아 있으면 그 배치가 멈춘 것 (크론이 이후 실행을 조용히 스킵함)
  - `SELECT batch_name,status,started_at FROM batch_runs ORDER BY id DESC LIMIT 10`

### 오픈 후 검토 (인프라)
- **Supabase 리전 이전 검토** — 앱은 싱가포르, DB 는 도쿄(`ap-northeast-1`). 같은 리전이면 페이지당 ~70ms 추가 단축. 프로젝트 재생성 + 데이터 마이그레이션이 필요해 체감이 아쉬울 때만
  - ⚠️ **이전 시 `ddl/migrations/2026-08-06-db-timezone-kst.sql` 재실행 필수** — DB 타임존은 `pg_db_role_setting` 에만 남는 속성이라 새 프로젝트로 안 따라온다. 빠뜨려도 **에러가 없고** 모든 시각이 조용히 9시간 밀린다
- **`syncBills` 페이지 조회 병렬화** — 153초 중 124초가 186페이지 **순차** 조회. `syncVotes` 처럼 `pLimit(10)` 적용 시 20초대로 단축 (전체 체인 3분23초 → 1분20초). 새벽 배치라 실익은 작음
- **`calcPoliticianAxis`/`calcGroupAxisAvg` 에 `batch_runs` 기록 배선** — 현재 sync 3종만 기록 중

### 베타 오픈 후 — 1순위
15. **AI 분석 Zone 5 추가** — 참고 맥락(`context`) · 분석 한계(`limitations`) 접힘 표시 + Zone 4 "더 알아보기" 버튼 부활
16. 국회 X레이 메뉴 (시각화 5종)
    - ① 발의왕 vs 입법왕 산점도 ← 최우선
    - ② 정당별 관심 위원회 히트맵
    - ③ 여야 표결 온도차 TOP10
    - ④ 당론 이탈 의원 순위
    - ⑤ 법안 생존율 깔때기
17. **의원 AI 분석 기능** — [ANALYSIS.md](./ANALYSIS.md) 원칙 재사용 (의원 활동 프로파일·표결 패턴·대표발의 성향)
18. **밸런스게임 서비스 링크** — 당말사 내 미니 게임이 정착하면 별도 서비스(밸런스게임 서비스)로 확장. Phase 6: Venn 콜드스타트 자료
19. 재화 시스템 (credits 컬럼 + credit_logs 테이블)
20. 의원 별점 → 재화 소비로 전환

### 베타 오픈 후 — 2순위
21. 악성 댓글 실시간 감지 + 삼진아웃
22. 커뮤니티 고도화 (신고·검색·정렬)
23. 실시간 알림

---

## 미구현 기획 1: 재화 시스템

### 재화명 후보
"표" (한 표라는 의미, 서비스 철학과 연결) — 확정 전

### 지급
- 가입 시 무료 5표 지급
- 이후 구매 또는 활동으로 획득

### 소비
- 의원 별점 평가 → 1표 (무분별 평가 방지)
- 법안 찬반 투표 → 무료 (국민 참여 데이터 최대 수집)
- AI 성향 분석 → 3표
- AI 법안 분석 → 2표
- 댓글 차단 해제 (삼진아웃) → 10표

### 타 서비스 연동
일단 당말사 독립 재화로 운영.
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
당말사 내 미니 콘텐츠.
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
- 콜드스타트: 당말사 유저 → Venn 베타 우선 초대
