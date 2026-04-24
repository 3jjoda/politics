# 정치 바로미터 — 작업 이력
> 시간 역순 (최신이 위). 의미 있는 리팩토링·기능 추가만 기록.
> 현재 상태: [CLAUDE.md](./CLAUDE.md)
> 앞으로 계획: [ROADMAP.md](./ROADMAP.md)

---

## 2026-04-25 — 의원 상세 구조 재편 + 모바일 UX 개선

### 의원 상세 페이지 정보 구조 단순화 (`views/politician/politician_detail.ejs`)
분석 정보가 **히어로 레이더 / 사이드바 카드 3개 / 개요 탭** 3곳에 중복 흩어져 있던 문제 해결. 하나의 "분석" 탭으로 응집.
- 탭 순서 재배치 + 이름 변경: `[개요 분석, 법안 활동, 표결 내역, 국민 평가]` → `[분석, 법안 활동, 표결 내역, 국민 평가]`, **분석이 기본 오픈 탭** (기존 기본은 법안 활동)
- **히어로 레이더(4축 다이아몬드) 제거** — 분석 탭에 동일 레이더 있음
- **사이드바 전체 제거** (`<aside class="sidebar">`) — 3개 카드 모두 중복:
  - `표결 요약` 도넛 차트 → 분석 탭 "표결 성향" 바 차트
  - `관심 분야 Top 5` → 분석 탭 "대표발의 관심분야 TOP 5"
  - `기본 정보` → **별도 카드 없이 아바타 오른쪽 컬럼에 통합**. `.profile-subinfo` 라는 `<dl>` 로 meta 행 아래에 이어지도록 배치 (border-top 구분선). 중복 제거: 지역구·선출방식·재선·위원회는 meta 행에 이미 있어서 subinfo 에서 뺌. 남는 항목은 생년월일·성별·이메일·홈페이지·국회 프로필 5가지
    - 레이아웃: `display: flex; flex-wrap: wrap; gap: 10px 28px` — 자연스럽게 흘러가는 배치
    - 이메일만 `.full { flex-basis: 100% }` 으로 단독 행 → 시각적 흐름이 `생년월일·성별 / 이메일 / 홈페이지·국회프로필` 3줄
    - `dt` 의 `min-width` 미설정 — 라벨 글자 폭만 차지해서 "성별 남성" 같은 짧은 항목도 라벨·값이 10px 간격으로 붙음
    - 모바일(≤1024px): 각 항목 `flex-basis: 100%` 로 수직 스택, identity 블록 전체 중앙 정렬
    - 외부 링크 카피 통일: 홈페이지·국회 프로필 모두 "바로가기 →"
- `content-wrap` CSS: `grid-template-columns: 1fr 300px` → 단일 컬럼, 반응형 `.content-wrap { grid-template-columns: 1fr }` 삭제
- 사용 안 하게 된 CSS 삭제: `.sidebar`, `.profile-radar-wrap`, `.profile-radar-label`
- **히어로 KPI 행(발의·표결 참여율·가결율)을 분석 탭 최상단으로 이동** — 모바일 세로 스택 시 `아바타+이름 → 기본정보` 가 바로 이어져 한 눈에 들어오도록. 분석 탭은 "숫자 요약 → 시각화" 흐름(KPI 행 → 레이더/표결성향/관심분야 그리드)
- `.profile-identity { margin-bottom: 24px }` 제거 — KPI 행이 빠져서 뒤에 뭔가 이어지지 않으므로
- 법안 활동 탭 카드 링크: `b.link_url` (국회 원안) → `/bill/<%= b.bill_id %>` (내부 법안 상세)

### 모바일 반응형 개선
- **헤더 wordmark 모바일에서도 노출** — 원래 `display: none` 이었던 걸 높이 `28px → 22px` 로 축소 + 표시 (`main.css:130`)
- **법안 데이터 갱신 시각을 햄버거 패널 상단에 추가** (`.pb-mobile-freshness`) — nav 배지는 공간 제약으로 모바일에서 숨긴 대신 메뉴 열면 최상단에서 바로 보이도록
- **의원 리스트 그리드/리스트 토글 모바일에서 자동 리스트 강제** — `#grid-view { display: none !important }` / `#list-view { display: block !important }`, 토글 버튼 자체도 숨김 (`views/politician/politician.ejs`)
- **의원 리스트 사이드바 필터를 모바일 바텀시트로** — `.filter-sheet-btn` 추가, `body.filter-sheet-open` 으로 슬라이드업, 백드롭·× 버튼·ESC 닫기, 활성 필터 개수 배지(sex/ageBucket/cmit/elect 합산, party 는 히스토그램 UI 라 제외)

### ROADMAP 갱신
- 2순위 17번 "의원 상세 개요 분석 탭 오픈" 항목 완료 처리 (분석 탭 오픈 + 재편으로 대체) — 라인 제거, 이후 번호 재매핑

### 공용 `.pb-page-header` 패턴 (`public/styles/main.css`)
섹션별 페이지 타이틀 UI 가 `bill/politician` (hero 그라디언트), `glossary/community/about` (평범한 wrapper) 로 일관성 없이 나뉘어 있던 것을 하나로 통일.
- `main.css` 에 `.pb-page-header / .pb-page-header-inner / .pb-page-title / .pb-page-desc` 추가
  - `margin-top: calc(-1 * var(--nav-h))` + `border-top: var(--nav-h) solid transparent` 트릭으로 그라디언트가 고정 nav 뒤까지 깔림
  - `padding: 72px 24px 32px` — breadcrumb 제거한 뒤 타이틀(Bebas Neue 44px) 이 nav 에 가려지던 문제 해결 (기존 40px → 72px)
  - `.pb-page-header-inner` 는 `flex + justify-content: space-between` 이라 우측에 액션 버튼(예: 커뮤니티 글쓰기) 배치 가능
- 적용: `bill.ejs` / `politician.ejs` / `glossary.ejs` / `community/list.ejs` / `about.ejs` — 페이지 자체 CSS 제거 + HTML 만 공용 클래스로 교체
- Breadcrumb 정책 확정: **목록/랜딩 페이지는 제거**(bill, politician, glossary), 상세/sub 페이지는 유지(bill_detail, politician_detail, community/detail, community/write)
- Wrapper 계열 padding 통일: 이전엔 28/36/64px 섞여 있던 걸 `calc(var(--nav-h) + 36px)` 한 벌로 (`bill_detail` 28→36, `about-main-container` 64→calc, 글로벌 `.pb-page-header` 는 자체적으로 nav 처리하므로 그 하위 wrapper 는 `36px` 만)

### 의원 분석 탭 월별 발의 막대 그래프 개선 (`views/politician/politician_detail.ejs`)
- **버그 수정**: `.month-bar.highlight { background: var(--cyan) }` 에서 `--cyan` 이 어디에도 정의돼있지 않아 transparent 로 떨어져 max 대비 80% 이상인 월이 안 보이던 문제 — `var(--accent2)` (브랜드 골드 호버톤) 로 교체
- 0건 월 차트 렌더 생략 (`<% if (cnt > 0) %>`) + 기존 `min-height: 2px → 6px` 로 1건도 확실히 보이게
- 값 레이블 (`.month-val`) 호버에서만 노출 → **항상 노출**로 변경. `.month-bar` 내부로 이동해서 막대 높이에 따라 레이블 위치가 따라오도록 (이전엔 wrapper 최상단에 고정되어 짧은 막대와 시각적 단절)
- 차트 높이 `120px → 140px`, `padding: 0 0 24px → 18px 0 24px` — 상단 값 레이블 공간 확보

### 표결 성향 바 차트 수치 보강 (`views/politician/politician_detail.ejs`)
- 기존 "찬성 비율 45.2%" → "찬성 비율 45.2% (1,234건)" — 퍼센트 옆에 실제 건수 괄호로 병기. 찬성/반대/기권/불참 4개 항목 모두

### 법안 페이지 사이드바 위원회 이름 축약 (`views/bill/bill.ejs`)
긴 위원회 이름이 우측 카운트 영역을 침범하던 문제. 데스크톱만 축약, 모바일 바텀시트는 여유가 있으니 줄바꿈으로 전체 노출.
- 데스크톱: `.side-item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }` — CSS 말줄임 (처음엔 서버사이드 `slice(0, 8) + '…'` 로 구현했다가 모바일/데스크톱 분기를 CSS 로 단순화). `title` 속성은 호버 툴팁으로 전체 이름 노출
- 모바일(바텀시트): `white-space: normal; word-break: keep-all` — 폭 여유로 줄바꿈

### 필터 시트 UX 전면 개편 (의원 + 법안 공통)
선택 즉시 검색이 아니라 **여러 항목 선택 후 적용**으로 변경. PC 사이드바도 동일 패턴.
- 사이드바 상단에 `.filter-sheet-header` 상시 노출 (sticky) — `[필터] [초기화] [적용] [×(모바일 only)]`
- 클릭 시 `.active` / `.sheet-pending` 만 토글, `applyFilter()` / navigation 은 **적용 버튼에서만** 커밋
- 취소(×·백드롭·ESC): 시트 열기 전 상태로 복원 (politician 은 state 스냅샷, bill 은 URL 재로드)
- **복수선택 지원**:
  - `politician.ejs` — `state.sex/ageBucket/cmit/elect` 를 배열로 전환, 카테고리 내 OR · 카테고리 간 AND 매칭. 배지는 선택 항목 총 개수
  - `bill.ejs` — `pendingCmt` / `pendingParty` Set 관리, 적용 시 `?committee=A,B&party=X,Y` URL 로 navigation. "기타/특별위원회" 는 minor 이름들의 쉼표 연결 value 로 atomic 토글 (그룹 내 모든 이름이 pending 에 있을 때만 active)
- `.sheet-pending` CSS 전역화 — 서버렌더 `.active` 는 JS init 에서 제거 후 `.sheet-pending` 으로 교체하여 이후 인터랙션은 pending 만 관리

### 법안 페이지 정당 필터 (복수선택)
서버사이드 party 필터 신규 추가.
- `daos/queries/bill/getList.sql` — `$6 party` 파라미터 + `LEFT JOIN politicians p ON p.mona_cd = b.mona_cd` + `COALESCE(p.party_name, '기타/무소속') = ANY(string_to_array($6, ','))`
- `getStatusCounts.sql` — committee 와 동일하게 party 필터도 반영하여 상태 탭 숫자 일관성 유지 (`$2 party`)
- `BillDao` / `BillService` / `BillController` 시그니처에 party 전파
- `views/bill/bill.ejs` — 정당별 사이드바 `<div class="side-item">` → `<a class="side-item" data-party-value="X" href="…">` 로 전환, "전체" 항목 추가. 각 링크 `href` 에 현재 query.committee/search/status 보존. 폼 hidden input · 상태탭 링크 · 페이징 hrefBuilder 전부 `query.party` 포함

### 법안·의원 필터바 모바일 구조 통일
- 모바일에서 **필터 버튼이 검색 바 위**로 올라가도록 `filter-sheet-btn { flex-basis: 100%; justify-content: center }`
- 의원 페이지: 총원 count 를 `filter-right` 안으로 이동 → 바 우측에 검색 입력과 함께 정렬. 모바일에선 `.filter-right { width: 100% }` + `.filter-count { margin-left: auto }`

### 모바일 의원 리스트 (`views/politician/politician.ejs`)
그리드 토글 숨김 후 리스트 전용으로 전환한 뒤, 리스트 아이템 정보 밀도 개선.
- 기존 열 구조 `[avatar, 의원, 정당(text), 발의, 공동, 상세]` 6열 → `[avatar, 이름+정당배지, 발의, 공동, 상세]` 5열
- 정당 텍스트 컬럼 제거 + 이름 옆에 `.pol-party-badge` 컬러 배지 inline (PC 그리드 카드와 동일 색상)
- 모바일(≤768px): 공동·상세 컬럼 숨김, 발의 숫자 옆에 "발의" 라벨 노출 (`.pol-list-num-label { display: none }` 기본 + 모바일에서 `display: inline-block`)

### 홈 모바일 가로 오버플로우 수정 (`views/index.ejs`)
주목할 법안 카드가 좁은 viewport(~500px 이하)에서 우측이 잘리는 문제.
- **원인**: 그리드 트랙 `grid-template-columns: 1fr` 의 default `min-width: auto` 때문에 카드의 intrinsic min-content (긴 위원회명 배지 등)가 트랙을 컨테이너 밖으로 밀어냄
- **해결**: `minmax(0, 1fr)` 로 트랙이 content min-content 와 무관하게 0 까지 축소되도록 함 (`.trending-grid`, `.home-kpi` 모두 적용)
- 부가: 모바일 padding 축소 (`.pb-section` 24→12, 카드 24→18/14), 긴 토큰 안전 분리 (`overflow-wrap: anywhere` 를 `.bill-name` · `.pb-badge` 에), `.kpi-card.large` 세로 스택
- 정리: 처음엔 `.pb-main { overflow-x: clip }`, `.pb-section { overflow-x: hidden }`, 다중 `min-width: 0` 같은 방어 코드를 여럿 깔았으나 `minmax(0, ...)` 도입 후 모두 불필요해져 제거

### "시민" → "국민" 용어 통일
중립성 브랜드 톤 조정. 사용자 노출 전부 교체.
- UI: `layout.ejs` OG/meta × 3, `bill_detail.ejs` "국민 찬반"·"국민 의견"·"로그인한 국민들", `auth/setup.ejs` 닉네임 placeholder "현명한국민", `interactions.js` 에러 메시지
- 주석: bill_detail / main.css / interactions.js / getStats.sql 각종 주석
- 문서: CLAUDE.md (스키마 주석, 라우트·API 설명), ROADMAP.md, ANALYSIS.md, CHANGELOG 과거 항목
- 유지: DB 테이블 `bill_citizen_votes`, 폴더 `citizen_vote/`, 함수 `PB.mountCitizenVote()`, CSS 클래스 `.citizen-vote-section` 등 **기술 식별자는 그대로** — 내부 레이블만 바꾸면 대규모 리팩토링 유발

---

## 2026-04-24 (밤) — 데이터 갱신 시각 배지

### 의미 없던 `● LIVE` 정적 배지 → "● 법안 N시간 전 갱신" 으로 교체
nav 우측 배지가 실제 시그널을 전달하도록 수정. `syncBills.js` 가 `ON CONFLICT ... updated_at = NOW()` 로 시각을 찍어주고 있어서 스키마 변경 없이 `MAX(bills.updated_at)` 한 줄로 구현 가능했음. 크론 배치 도입 시 배지가 자연스럽게 살아있는 시그널이 됨.

### 구현
- `utils/dataFreshness.js` 신규
  - `getBillFreshness(db)` — `MAX(bills.updated_at)` 조회 + 10분 메모리 캐시
  - `formatRelativeKo(date)` — 분/시간/일/주/달 한국어 상대시간 (음수 방어 → "방금 전")
  - `dataFreshnessMiddleware(db)` — `res.locals.dataFreshness = { lastUpdated, relative, absolute }` 주입, 조회 실패 시 이전 캐시 유지·없으면 `null`
- `app.js` — `injectUser` 다음에 미들웨어 등록
- `views/layout.ejs` — `● LIVE` → `<% if (locals.dataFreshness) %>` 조건부 `● 법안 <%= relative %> 갱신` + `title` 속성에 절대시각 (Asia/Seoul 로케일)
- `public/styles/main.css` `.pb-nav-badge` — `JetBrains Mono` 제거(한글 대응) + `white-space: nowrap` + 모바일(≤768px) `display: none`

### 판단 배경
- **표결 갱신 시각은 의도적으로 제외** — `bill_votes` 엔 `updated_at` 컬럼이 없고, `MAX(vote_date)` 는 "국회가 마지막으로 표결한 날"이라 "데이터 신선도"와 의미가 다름. nav 배지엔 단일 시그널만 노출.
- 방문자 수·실시간 접속자는 초기엔 작은 숫자가 오히려 신뢰도를 깎고, 실시간 추적은 heartbeat 인프라가 별도로 필요해서 제외.

---

## 2026-04-24 (저녁) — 표결 명단 모달화 + 한글 초성 검색 + 카피 톤 조정

### 본회의 표결 결과 UI 개편 (`views/bill/bill_detail.ejs`)
기존 4박스 아래 2×2 `.vote-lists` 로 늘어뜨리던 명단을 전부 **모달**로 옮김 — 상세 페이지 스크롤 피로도 해소.
- 찬성/반대/기권/불참 박스를 `<button data-bucket="...">` 으로 전환, 숫자 아래 "명단 보기" 힌트
- 0표 버킷은 `data-empty` 로 클릭 비활성
- 모달 구성: 버킷 라벨(색상 점) + 정당별 필터 칩(카운트 포함, 인원 많은 순) + 이름 검색 + 5열 × 8줄 고정 그리드(`height: 456px`)
- 명단 chip 은 발의자 섹션의 `.proposer-chip` 재사용 → 시각 일관성
- 정당별 chip 배경 tint — `politician.ejs` 6색 팔레트 재사용 (민주당 청색 / 국민의힘 적색 / 조국혁신 자색 / 개혁신당 주황 / 진보당 적갈 / 기타 회색, bg 0.08 alpha / border 0.28 alpha)
- 퇴임 의원: 필터에 "퇴임 N명" 칩으로 집계 표시, 개별 chip 은 `.retired` 로 클릭 불가 회색 유지
- 모달 닫기: backdrop · × 버튼 · ESC · body 스크롤 잠금
- 폐기된 CSS: `.vote-lists / .vote-list-container / .voter-list / .retired-voter`
- 모바일(≤768px): 그리드 `auto-fill minmax(130px, 1fr)` 2열, 높이 `60vh`

### 한글 초성 검색 헬퍼 (`public/scripts/interactions.js`)
공용으로 쓸 수 있게 `PB` 네임스페이스에 추가.
- `PB.toChoseong('김철수') → 'ㄱㅊㅅ'` — U+AC00~D7A3 음절을 `(code-AC00)/588` 로 초성 인덱스 계산 후 compat-jamo 로 변환
- `PB.isChoseongOnly(q)` — 쿼리가 compat-jamo 자음(ㄱ-ㅎ)만인지 판별
- `PB.matchesQuery(target, query)` — 1) 직접 `includes` (영문은 `toLowerCase`) 2) 실패 & 쿼리가 초성만이면 `toChoseong(target).includes(q)` fallback
- 적용: 법안 상세 표결 모달 이름 검색, 의원 리스트(이름 + 지역구 — `ㅈㄹ` → "종로" 매칭)

### 사용자 노출 카피 "추적" → "확인" 교체
감시·미행 뉘앙스가 중립성 브랜드와 어긋나 4곳 교체. 내부 기술 문맥(prompt_version 추적, 비용 추적, request trace ID, filter dataset 추적)은 의미가 달라 그대로 유지.
- `views/index.ejs` — "실시간 **추적** 중" / "모든 활동을 **추적**합니다"
- `views/politician/politician.ejs` — "의정 활동을 모두 **추적**합니다"
- `views/bill/bill.ejs` — "발의부터 처리까지 모두 **추적**합니다"

---

## 2026-04-24 — AI 법안 분석 기능 1차 구현

### 분석 원칙 수립 ([ANALYSIS.md](./ANALYSIS.md) 신규)
- 법안 분석 설계 원칙 14개 수립 (v1 → v4 진화)
- 4개 모델 × 4개 프롬프트 버전 × 4개 법안 유형 실증 테스트
- Haiku + v4 프롬프트를 메인 엔진으로 확정
- 예산 97% 절감: $252 가정 → $7.5 확정

### UI 표시 원칙 수립 (5-Zone 구조)
- Progressive Disclosure · Reading Rhythm · Time Promise 원리 기반
- Zone 1 훅 / Zone 2 빠른 이해 / Zone 3 쟁점 / Zone 4 판단 / Zone 5 전문 정보
- MVP는 Zone 1~4 (Zone 5 는 후속 작업)

### DB 구조 (`etc/ddl/bill_ai_analysis.sql` 신규)
- `bill_ai_analysis` 테이블 신설 — JSONB 중심, 5-Zone 구조 직접 매핑
  - `summary / category / reading_time_min / changes / affected / issues / context / limitations / judgment_questions`
  - 메타: `model / prompt_version / tokens_input / tokens_output / cost_usd / needs_review / review_status`
- 인덱스: `prompt_version` / `needs_review (partial WHERE TRUE)` / `category`
- `update_updated_at()` 공용 트리거 적용
- 환경교육법(`bill_id=PRC_J2J6R0S4Q1R3P1P0O3K1K0J9J4I1I0`) 샘플 INSERT 포함 — `prompt_version='v4-sample'` 로 실제 분석과 구분, `ON CONFLICT DO UPDATE` 멱등

### 백엔드 구현
- `daos/queries/bill/getAiAnalysis.sql` 신규
- `BillDao.getAiAnalysis(billId)` — 없으면 null 반환
- `BillService.getAiAnalysis` 프록시 추가
- `BillController.getDetailPage` — 기존 `Promise.all` 에 병렬 조회 합류 + 실패 시 null fallback + `logger.warn`

### 프론트엔드 UI (`views/bill/bill_detail.ejs`)
- 법안 상세 페이지 5-Zone UI 구조 추가 (인라인 `<style>` 약 260줄)
- XSS-safe JSON 주입: `JSON.stringify(analysis).replace(/</g, '\\u003c')` — `</script>` 브레이크아웃 차단 (3곳 적용)
- 섹션 재배열: 메타 → AI 분석 → 원문 → 국민 찬반(`#citizen-vote-section`) → 본회의 → 발의자 → 댓글
- Noto Serif KR `wght@400;700;900` 폰트 로드 (`views/layout.ejs`)

### 위젯 (`public/scripts/interactions.js`)
- `PB.mountBillAnalysis` 신규
- `renderRichText()` 헬퍼 — 전체 HTML 이스케이프 후 `<strong>` 페어만 복원하는 선별 이스케이프
- Zone 3 accordion — 첫 번째만 기본 펼침, 클릭 시 `max-height` 트랜지션, 아이콘 `↓ 펼치기 ↔ ↑ 접기`
- Zone 4 "찬반 투표하기" → `#citizen-vote-section` smooth scroll (기본 full-width 골드 버튼 1개)
- "더 알아보기" 버튼은 Zone 5 구현 전까지 렌더하지 않음
- `bill.link_url` falsy 시 국회 원문 링크 미렌더

### 법안 상세 헤더 리팩토링
- `.bd-header` 카드와 Zone 1의 정보 중복 제거 — 헤더 카드 완전 삭제
- 통합된 카드 구조:
  - 분석 있음: 메타 2줄(식별자 / 발의 정보) + 법안명(`<h1>`) + 한 줄 요약(`<h2>`, 세리프 28px/900) + 태그 3개
  - 분석 없음: `.bill-basic-header` — 메타 2줄 + 법안명. Zone 1과 동일한 카드 스타일(공용 셀렉터)
- 발의일 포맷 `YYYY-MM-DD → YYYY.MM.DD`
- 대표발의자 이름에 `/politician/:id` 링크 (`proposer_mona_cd` 있을 때)
- 국회 원문 버튼을 헤더 카드 우측 상단으로 이동(`.zone-1-top > .original-link`) — 이전엔 헤더와 국민찬반 사이에 단독으로 떠 있어 시각적으로 분리됨
- 폐기된 클래스: `.bd-header / .bd-title / .bd-meta / .bd-meta-row / .bd-external` (main.css 공유 shadow 셀렉터에서도 제거)

### 모바일 대응 (≤768px)
- Zone 2 카드: grid 3열 → 세로 스택 1열
- Zone 4 CTA: flex → 세로 스택
- Zone 1 한 줄 요약: 28px → 22px, 법안명: 22px → 19px
- 국회 원문 링크: 폰트 11px · padding 3px 8px 로 축소, `flex-wrap + margin-left:auto` 로 공간 부족 시 메타 아래 오른쪽 정렬

---

## 2026-04-23 (저녁) — login 로고도 분리 배치

nav 와 같은 이유(워드마크 텍스트 작음) 로 **login 카드 로고도 마크+워드마크 분리** 로 교체.
- 기존: `<img src="logo-primary.svg" class="auth-logo-img" height=44>`
- 변경: `mark-only.svg` 48×48 + `wordmark-nav.svg` h36px (gap 12px)
- CSS: `.auth-logo-img` → `.auth-logo-mark-img` + `.auth-logo-wordmark-img`
- `logo-primary.svg` 는 login 에서 빠짐 → 현재 전 페이지 미사용 (보존)

---

## 2026-04-23 (오후) — 브랜드 에셋 통합 & 메타태그

공식 로고/파비콘 세트 확정 → 프로젝트 전반에 배치.

### 에셋 구성 (`public/assets/imgs/`)
- **로고 풀셋**: `logo-primary.svg` (골드 #B8740C, 480×120), `logo-white.svg` (다크 배경용), `logo-mono.svg` (인쇄용)
- **분리 요소**: `mark-only.svg` (64×64 서클+체크마크), `wordmark-kr.svg` (정치 바로미터 + "내 한표의 바로미터" 2줄), `wordmark-en.svg` (영문 태그라인), `wordmark-nav.svg` (280×48 단일행, nav 전용)
- **파비콘**: `favicon.ico`, `favicon-16.svg`, `favicon-32.svg`, `apple-touch-180.png`
- **앱 아이콘**: `app-icon-192.png`, `app-icon-512.png`, `app-icon-1024.png` (스토어용)
- **OG**: `og-image.png` (1200×630)
- **로딩 연출(미배치, 대기)**: `splash.svg` (0.8s 원 → 0.3s 세로 → 0.25s 사선 한번 그리기), `spinner.svg` (2.5s 루프)

### layout.ejs `<head>`
- Primary: description/keywords/theme-color(#B8740C)
- Favicon 5종 링크 + `rel="manifest"` href="/manifest.json"
- OG 11개: type/title/description/url/image(+w:1200/h:630)/site_name/locale=ko_KR
  - url/image 모두 `process.env.BASE_URL` 기반 절대 URL (`BASE_URL + (locals.currentUrl || '/')`)
- Twitter: `summary_large_image` 카드 4종

### nav 로고 구조 (layout.ejs + main.css)
단일 `logo-primary.svg` 로는 워드마크 글자가 눌려서 작게 렌더링 → **마크+워드마크 분리**로 각각 독립 크기 제어.
```html
<a href="/" class="pb-logo" aria-label="정치 바로미터">
  <img src="/assets/imgs/mark-only.svg"    class="pb-logo-mark-img"     alt="" aria-hidden="true">
  <img src="/assets/imgs/wordmark-nav.svg" class="pb-logo-wordmark-img" alt="정치 바로미터">
</a>
```
- 데스크탑: 마크 36×36 + 워드마크 h28px (gap 10px)
- ≤768px: `.pb-logo-wordmark-img { display: none }`, 마크 32×32 로 축소
- `wordmark-nav.svg` 는 태그라인 제거한 단일행 전용 (`wordmark-kr.svg` 는 태그라인 포함 보존)

### login 카드 로고
- 기존 clip-path 다이아몬드 + Bebas Neue 텍스트 → `logo-primary.svg` h44px 로 교체
- `.auth-logo-mark`, `.auth-logo-text` CSS 제거

### PWA manifest (`public/manifest.json` 신규)
```json
{
  "name": "정치 바로미터", "short_name": "바로미터",
  "start_url": "/", "display": "standalone",
  "background_color": "#F7F6F1", "theme_color": "#B8740C",
  "icons": [{ src, sizes: "192x192"|"512x512", purpose: "any maskable" }]
}
```
- Android Chrome "홈 화면에 추가" 시 theme-color/icon 적용
- iOS 는 `apple-touch-icon` 링크로 별도 처리

### 구조 변경 요약
- 삭제: `.pb-logo-mark` (clip-path 다이아몬드), `.pb-logo-text`, `.auth-logo-mark`, `.auth-logo-text` (CSS + HTML 전 레포)
- 유지: `old_header.ejs` (참조 0건, 추후 정리), `_logo.png`/`_favicon.png` (언더스코어 백업)

---

## 2026-04-23 (오전) — 대형 리팩토링

### 분류 체계 전환: bill_topic_cd → committee
핵심 아키텍처 변경. `codes.BILL_TOPIC` (수동 16개 분류) 체계를 폐기하고 **위원회(committee)** 단일 기준으로 통합.

- `syncBills.js` 에 `committee`, `committee_id` 컬럼 저장 추가
- `updateCommittee.js` 신규 — 기존 레코드 일괄 보강
- SQL 8개 파일에서 `LEFT JOIN codes BILL_TOPIC` 제거, `committee AS bill_topic_nm` 로 단일 소스화
  - `getTopicCounts`, `getList`, `getStatusCounts`, `getTrending`, `getDetail`, `getListOne`, `getBillsByMonaCd`, `getVotesByMonaCd`
- `getList.sql` 필터 파라미터: `bill_topic_cd (int)` → `committee (text, 쉼표 분리 복수 지원)`
- URL 파라미터 전면 교체: `/bill?topic=1` → `/bill?committee=보건복지위원회`

### 홈페이지 개편
- **카테고리 탭 고정 9개** (전체/보건복지/조세재정/산업기술/노동환경/국토주택/과학ICT/교육/사법행정) — 위원회명 링크
- **주목할 법안 정렬 탭 신규** — 최근 가결 / 박빙 표결 / 많은 동참 / 여야 협력
  - `/api/bills/trending?sort=...` JSON 엔드포인트 + JS 동적 재렌더
  - SQL은 `CASE WHEN $1` 분기로 단일 쿼리 유지
- `getTrending.sql` — 가결(`원안가결/수정가결`)만 노출, `DISTINCT ON (bill_name)` dedupe
- 히어로 카드 중첩 `<a>` 파싱 버그 수정 — `<a class="pb-help">` 9곳 전부 `<span data-help-href>` 로 교체, `interactions.js` 에 클릭 위임 추가

### 의원 상세 레이더
- **6축 육각형 → 4축 다이아몬드** (법안발의 / 공동발의 / 표결참여 / 가결율)
  - 데이터 없던 3축(출석률·위원회·소통) 제거 → "일부 축 데이터 수집 후 반영" 안내 제거
  - 꼭짓점에 라벨 + 수치 함께 표시 ("법안발의 30건" 등)
- 스케일 기준 DB 실시간 집계 — `getRadarScale.sql` (p90 분위수)
- 프로필 사진 96px → 240px (레이더와 동급)
- 표결요약 도넛 확대 (90→120, 내부 % 수치 30px)
- 법안 탭 페이징 버그 수정 (필터/페이지 상태를 `dataset.filtered` 로 분리)
- 국회 공식프로필 URL 신규 포맷 (`/members/22nd/{ENG_NM}`)

### 필터 UX
- **카테고리 ↔ 상태 탭 연동** — `getStatusCounts` 에 committee 파라미터 추가. committee 선택 시 스테퍼 4단계·상태 탭 8개 숫자가 모두 해당 위원회 기준으로 재계산
- 사이드바 100건 미만 위원회 → "기타/특별위원회" 자동 묶음 (콤마 분리 URL 사용)
- 긴 위원회명 wrap (`word-break: keep-all`, `flex:1`, `min-width:0`)
- 사이드바 sticky + 내부 스크롤 + `flex-shrink:0` 패턴 (의원/법안 목록 공통)
- `body { overflow-x: hidden → clip }` — sticky 동작 정상화 root cause

### 커뮤니티 & 댓글
- 상세 페이지 3개 카드 → 1개 카드로 통합 (`.post-card` + section border-bottom)
- 목록 카드 이모지(👁👍💬) → SVG 아이콘, 패딩 업
- 글쓰기 "법안 검색" 버튼 제거, 검색창 항상 노출
- **댓글 대댓글 1단계 중첩** (`buildTree` root 플랫화, tombstone 처리, 답글 버튼 root 전용)

### 기타
- 홈 trending 쿼리/index.ejs 전반에 null 방어
- 법안 카드 미니바: `vote_for || vote_against` 체크로 기권만 있는 경우 skip
- 법안번호 뱃지 축소 (11px → 10px + opacity 0.7)

---

## 2026-04-22 — UI 개편·인증·상호작용·커뮤니티

### UI 전면 개편
1. **다크 → 라이트 테마 전환** (베이지 bg + 골드 --accent #B8740C, `--blue` 변수 제거·`--accent` 로 리네이밍)
2. **디자인 크리틱 반영**: 중립 컬러·이니셜 아바타·KPI 해석 문구·계류 경과일·법안 뱃지 `?` 용어 링크
3. **타이포/컴포넌트 업스케일** (14→15px, nav 56→60px, 카드 padding/radius 확대, JetBrains Mono 1px 업)
4. **페이지 시그니처 요소**: 홈 월별 추이 라인차트, 의원 목록 정당 히스토그램, 법안 목록 4단계 스테퍼, 의원 상세 레이더 260px 승격

### 인증 시스템 구축
5. **Passport + express-session + connect-pg-simple** 세팅
6. **구글·카카오 OAuth** (비즈 미승인 대응: email NULL 허용)
7. **신규 가입 `/auth/setup` 플로우**: 닉네임(필수, 2~20자 한/영/숫자/_) + 성별 + 연령대 **3개 모두 필수**
8. **회원 탈퇴**: 개인정보만 익명화, `gender/age_group` 은 통계용으로 보존

### 상호작용 기능
9. **댓글 API** (`type: politician | bill | post`, 소프트 삭제)
10. **의원 별점** (1~5, 평균·분포·나의 점수)
11. **법안 국민 찬반** (의원 본회의 표결과 분리, 1인 1표 변경 가능)
12. **좋아요 토글** (comment/post)
13. **용어 설명 페이지** (`/glossary`, 목차 + 4섹션, 뱃지 `?` 링크 연결)

### 커뮤니티
14. **게시판** (`/community` 목록/작성/수정/삭제/상세, 20개/페이지)
15. **법안 첨부 기능**: 작성 중 `/api/bills/search` 디바운스 검색 → 1건 첨부, 상세에서 카드로 링크

---

## 폐기된 배치 파일

| 파일 | 사유 | 폐기 시점 |
|------|------|-----------|
| `topicUpdate.js` | Claude API 기반 16종 분류 — **committee 단일 기준으로 대체** | 2026-04-23 |
| `updateByCommittee.js` | DB 직접 committee→topic_cd 매핑 — **committee 자체를 쓰므로 매핑 불필요** | 2026-04-23 |

> 두 파일은 현재 코드베이스에 남아있으나 호출부 없음. 베타 이후 `bill_topic_cd` 컬럼 DB 드롭 시점에 함께 삭제 예정.
