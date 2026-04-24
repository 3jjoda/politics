# 정치 바로미터 — 작업 이력
> 시간 역순 (최신이 위). 의미 있는 리팩토링·기능 추가만 기록.
> 현재 상태: [CLAUDE.md](./CLAUDE.md)
> 앞으로 계획: [ROADMAP.md](./ROADMAP.md)

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
- 섹션 재배열: 메타 → AI 분석 → 원문 → 시민 찬반(`#citizen-vote-section`) → 본회의 → 발의자 → 댓글
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
- 국회 원문 버튼을 헤더 카드 우측 상단으로 이동(`.zone-1-top > .original-link`) — 이전엔 헤더와 시민찬반 사이에 단독으로 떠 있어 시각적으로 분리됨
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
11. **법안 시민 찬반** (의원 본회의 표결과 분리, 1인 1표 변경 가능)
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
