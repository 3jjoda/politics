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
   - 2026-08-12 확인: API 실재 확인됨 (`infaId=OBL7NF0011935G18076`, "역대 국회의원별 소속정당·위원회·재선여부·당선대수"). 같은 계열로 `역대 국회의원 위원회 경력`·`역대 국회의원 의원이력` 도 있음. 호출 스펙(오퍼레이션 코드)은 미확인
   - 퇴임 의원 상세 페이지는 "22대 재임(YYYY.MM.DD ~ YYYY.MM.DD)" 표기 + 표결·발의 이력은 그대로 노출
4. 여야 협력(bipartisan) 탭 실데이터 구현
5. 모바일 반응형 점검 (nav 로고는 완료, 나머지 페이지 필요)
6. footer 링크 연결 (`/privacy` 등 `#` 처리된 것들)
7. **Google AdSense 신청** — 코드 준비 완료 (2026-08-10, `ADSENSE_CLIENT_ID` env 게이트). 남은 건 운영자 액션:
   - 애드센스 가입 → `dangmalsa.kr` 사이트 추가 → Railway 웹 서비스에 `ADSENSE_CLIENT_ID=ca-pub-...` 세팅 → 재배포 → 콘솔에서 "검토 요청"
   - 승인 심사 며칠~2주. 심사 중 사이트가 계속 살아 있어야 하므로 이 기간에 Railway hard limit 상향(아래 인프라 체크리스트)을 먼저 해둘 것
   - ⚠️ **승인 직후 차단 관리 → "정치" 카테고리 차단** — 정당·후보 광고가 붙으면 중립성 브랜드와 정면 충돌
8. ~~OG 태그 적용 (og-image.png → layout.ejs)~~ ✅ 2026-04-23 완료
9. ~~법안 상세 페이지 UI 개선 (AI 분석 5-Zone 통합)~~ ✅ 2026-04-24 완료
10. ~~AI 분석 표시 시스템 + 분석 요청 시스템~~ ✅ 2026-04-25 완료 (진행률 배너, 통합 필터, 카드 배지·요약, 미분석 시 요청 위젯, 마이페이지)
11. **AI 분석 자동 트리거** — ✅ 2026-08-11 `fetchTargets` 개편 완료 (요청 임계값 편입 + 요청 우선 정렬 + 변경분 재분석). 상세는 [CLAUDE.md](./CLAUDE.md) "syncBillAiAnalysis.js". 남은 것:
    - ⬜ **크론 배선** — 아직 운영자가 수동 실행. 붙이기 전에 `--limit` 상한을 정할 것 (무제한이면 하루 비용이 튄다)
      - 2026-08-12: `genBriefing` 이 `batch:daily` 에 편입되면서 **크론 서비스의 `ANTHROPIC_API_KEY` 는 어차피 필수**가 됐다. 이 항목의 선행조건 하나는 해소된 셈 (키만 넣으면 `syncBillAiAnalysis` 도 체인에 붙일 수 있다)
    - ⬜ **본문 변경 감지** — 현재 재분석 트리거는 `bills.updated_at` 기반이라 `bill_name`/`proc_result_name`/`committee`/`committee_id` 변경만 잡는다. **계류 중 조문만 바뀐 경우는 못 잡음.** 크롤한 본문의 해시를 `bill_ai_analysis` 에 저장해 비교하는 방식이 필요
    - ⬜ **JSON 파싱 실패 재시도** — 실측 실패율 ~4%. 지금은 실패 처리 후 다음 실행에 재편입되는 것으로 흡수 중
    - ⬜ **`needs_review` 임계값 재조정** — 43.9% 가 플래그돼 검수 큐로서 변별력 없음 (`shouldReview` 휴리스틱)
12. **의원 활동 지표 확대 — 발언 데이터** (2026-08-12 조사 완료, 미착수)
    - 배경: "평가 축이 부족하다" 에서 시작한 공공 API 전수 조사(278건). **출석 API 는 존재하지 않는다** — 검색 0건, 국회가 공개하지 않는다.
      본회의 출석률은 이미 `bill_votes` 의 불참(43,871건, 24.8%)으로 산출 가능하므로, 진짜 빈 곳은 **상임위**다
    - 대안으로 **발언영상 API** (`npeslxqbanwkimebr`) 실측 검증 완료:
      22대 **61,384건** (2024: 26,801 / 2025: 29,929 / 2026: 4,654), 의원 커버리지 **293/309(95%)**, **회의 종류의 73%가 위원회**
    - 출력: 대수·회·차·회의일자·회의제목·**발언자**·**재생시간**·링크
    - 🔴 붙이기 전에 반드시 처리할 함정 4개 (전부 실측으로 확인):
      - **장관 답변이 의정활동으로 잡힌다** — 이름만 매칭하면 정성호·김윤덕·윤호중(현역 의원이자 장관)이 상위 1~3위가 된다. 성실도의 정반대를 재는 셈. 직위 화이트리스트 필수 (`장관` 1,229건 실측)
      - **위원장 사회 발언** — 최민희 1,397분이 전부 위원장석. 안건 호명이지 열심이 아니다. 전체의 14%, 59명. `politician_committees.job_res_nm` 으로 분리 가능
      - **중복 행 약 11%** — `LINK_URL` 의 `no=` 로 dedupe
      - **`REC_TIME` 은 순수 발언시간이 아니다** — 한 클립에 질의+답변이 함께 들어간다. **클립 수**가 더 안전한 단위
      - (동명이인 140건 — API 가 이름+정당만 줘서 `mona_cd` 확정 불가. 정당 보조 매칭 필요)
    - ⚠️ 지표화할 때 **위원회별 회의 빈도로 정규화**할 것. 소속(`politician_committees`)이 분모다 — 그래서 위원회를 먼저 붙였다
    - ⚠️ **"발언 많음 = 좋은 의원" 이 아니다.** 위원장·장관·원내대표는 구조적으로 다르다.
      교차표결 격차에 "다수당은 의사일정 구조상 격차가 낮다" 를 병기한 것과 같은 수준의 해석 주의가 필요

13. **직위 데이터 유지보수** (2026-08-12 시작, 상시)
    - `politician_titles` 14건 입력 완료. `/admin/titles` 에서 관리
    - 🔴 **2026-08-17 민주당 전당대회 직후 갱신 필요** — 현재 당대표 공석(정청래 06-24 사퇴), 한병도 원내대표가 직무대행.
      `review_after = 2026-08-18` 로 걸어둬서 배치가 알려준다
    - ⬜ 장관 5건 `source_url` 비어 있음 (발언기록이 근거라 URL 이 없다) — 배치가 매일 경고 중
    - ⬜ 당직 중 **최고위원·사무총장·정책위의장 미입력** (20~30명 규모, 교체 잦음). 핵심만 정확히 두는 쪽을 택했으나 필요해지면 추가

14. **prompt cache 활성화** — 현재 system prompt(~3,300 tok)가 Haiku 4.5 임계값(~4,096) 미달로 캐시 안 들어감. 예시·금지표현 추가로 4,500+ 토큰까지 늘리면 자동 활성. 절감 효과 = 1건당 cache_read $0.0033 (input × 0.10) ≈ -20%
15. **legacy `category` 컬럼 DROP** — v4.1 안정화 1주 후 (`bill_ai_analysis.category` 와 `bills.bill_topic_cd` 둘 다)
16. **정치 성향 밸런스 게임** — [BALANCEGAME.md](./BALANCEGAME.md) / [UI_BALANCEGAME.md](./UI_BALANCEGAME.md) 참조
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
17. **AI 분석 Zone 5 추가** — 참고 맥락(`context`) · 분석 한계(`limitations`) 접힘 표시 + Zone 4 "더 알아보기" 버튼 부활
18. 국회 X레이 메뉴 (시각화 5종)
    - ① 발의왕 vs 입법왕 산점도 ← 최우선
    - ② 정당별 관심 위원회 히트맵
    - ③ 여야 표결 온도차 TOP10
    - ④ 당론 이탈 의원 순위
    - ⑤ 법안 생존율 깔때기
19. **의원 AI 분석 기능** — [ANALYSIS.md](./ANALYSIS.md) 원칙 재사용 (의원 활동 프로파일·표결 패턴·대표발의 성향)
20. **밸런스게임 서비스 링크** — 당말사 내 미니 게임이 정착하면 별도 서비스(밸런스게임 서비스)로 확장. Phase 6: Venn 콜드스타트 자료
21. 재화 시스템 (credits 컬럼 + credit_logs 테이블)
22. 의원 별점 → 재화 소비로 전환

### 베타 오픈 후 — 2순위
23. 악성 댓글 실시간 감지 + 삼진아웃
24. 커뮤니티 고도화 (신고·검색·정렬)
25. 실시간 알림

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
