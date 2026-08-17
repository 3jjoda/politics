# 3jjoda 프로젝트 — Claude Code 컨텍스트
> 마지막 업데이트: 2026-08-16
> 이 파일은 **현재 코드 상태**만 담습니다.
> 비전·로드맵: [ROADMAP.md](./ROADMAP.md)
> 작업 이력: [CHANGELOG.md](./CHANGELOG.md)

## 문서 업데이트 규칙
- 코드 변경 → CLAUDE.md의 해당 섹션 업데이트
- 의미 있는 마일스톤 → CHANGELOG.md 맨 위에 추가 (역순)
- 기획 단계 → ROADMAP.md
- 기획이 구현되면 → ROADMAP에서 제거, CLAUDE.md에 추가, CHANGELOG에 기록
- 관련 문서:
  - [ANALYSIS.md](./ANALYSIS.md) — AI 법안 분석 생성 원칙 (v4 프롬프트)
  - [UI_ANALYSIS.md](./UI_ANALYSIS.md) — AI 분석 UI 표시 원칙
  - [BALANCEGAME.md](./BALANCEGAME.md) — 정치 성향 밸런스 게임 설계 원칙 (4축·매핑·D 레이어)
  - [UI_BALANCEGAME.md](./UI_BALANCEGAME.md) — 밸런스 게임 5단계 UI 설계 원칙
  - [BILL_AXIS_MAPPING_GUIDE.md](./BILL_AXIS_MAPPING_GUIDE.md) — 법안-축 매핑 가이드라인 (AI 1차 매핑 작업 지침)

---

## 나는 누구인가
- 닉네임: 3jjoda
- 개인 개발자 + 친구 1명과 협업 예정
- 목표: 이런 류의 서비스를 계속 구상하고 만들어내며 생계 유지
- 핵심 강점: 문제를 보는 눈, 역발상 아이디어, AI와 함께 빠르게 구현

---

## 서비스: 당말사

### 철학
"더 이상 당만 보고 투표하는 사람이 없도록"
내가 행한 한 표가 어떻게 나라를 굴리고 있는지 끝까지 지켜볼 수 있는 플랫폼.

### 브랜드 (2026-08-10 리브랜딩)
- 서비스명: **당말사** (구 "정치 바로미터")
- 태그라인: **"당 말고 사람"** (구 "내 한표의 바로미터")
- 골드 `#B8740C` · 점 복(卜) 마크는 그대로 승계 — 컬러/심볼 시스템 변경 없음
- 🔴 **리브랜딩은 코드만 고쳐선 안 끝난다** — OAuth 동의 화면(구글·카카오)에 구 서비스명이 남는다.
  위 "코드 밖 설정" 참조 (실제로 2026-08-16 까지 `정치 바로미터` 가 떠 있었다)
- ⚠️ CSS 클래스 prefix `.pb-*` 와 JS 전역 `window.PB` 는 **의도적으로 유지** (내부 식별자, 517곳)

### 레포 & 배포
- GitHub: https://github.com/3jjoda/politics (dev 브랜치)
- **대표 주소: https://dangmalsa.kr** (2026-08-10 연결)
  - `www.dangmalsa.kr` / `politics-production.up.railway.app` 은 여기로 **301** (`middlewares/canonicalHost.js`)
- DB: Supabase PostgreSQL (Transaction Pooler, ap-northeast-1)

### 인프라 구성 (2026-08-10)
```
가비아(도메인 등록) → Cloudflare(DNS·CDN·WAF) → Railway(앱) → Supabase(DB)
```
- **도메인**: 가비아 구매. 단 **네임서버는 Cloudflare** — 가비아 DNS 가 `ALIAS`/`ANAME` 을 지원하지 않아
  apex(`dangmalsa.kr`)에 Railway 의 CNAME 타겟을 붙일 수 없었다. Cloudflare 의 **CNAME flattening** 으로 해결
- **Cloudflare DNS 레코드 4개**: `@` CNAME → Railway 타겟 / `www` CNAME → Railway 타겟(다른 값) /
  `_railway-verify` TXT 2개(apex·www 각각). 프록시는 **켜짐(주황)**
- ⚠️ 프록시를 켤 때 **SSL/TLS 모드가 `Full (strict)` 여야 한다.** `Flexible` 이면 무한 리다이렉트
- ⚠️ 프록시는 **Railway 인증서 발급이 끝난 뒤에** 켤 것. 먼저 켜면 발급이 막힌다
- Railway 커스텀 도메인 한도는 플랜당 2개 — apex·www 로 정확히 소진 중
- 코드는 프록시 유무와 무관. `req.ip`/`X-Forwarded-For` 를 쓰는 곳이 0곳이라 `trust proxy: 1` 그대로 유효

### 🔴 코드 밖 설정 — 저장소에 없어서 잊히는 값들 (2026-08-16 정리)
**`git clone` 해도 따라오지 않고, 빠뜨려도 에러가 안 나는 설정들이다.** 조용히 틀린 채로 돌아간다.
리브랜딩·리전 이전·프로젝트 재생성 때 여기를 먼저 볼 것.

| 어디 | 무엇 | 빠뜨리면 |
|---|---|---|
| **Google Cloud Console** | OAuth 동의 화면 브랜딩 (앱 이름·로고·URL) | 로그인 화면에 **구 서비스명**이 뜬다 |
| **Kakao Developers** | 앱 이름·로고 | 위와 같음 |
| **Supabase 대시보드** | Data API(Exposed schemas) 끄기 | 전 테이블이 인터넷에 열린다 → 위 "Data API 는 꺼져 있다" |
| **Supabase DB** | 세션 타임존 KST (`ALTER DATABASE`) | 모든 시각이 9시간 밀린다 → `ddl/migrations/2026-08-06-db-timezone-kst.sql` |
| **Railway 대시보드** | 크론 스케줄·서비스별 환경변수·리전 | 배치가 안 돌거나 그날 전체가 멈춘다 |
| **Cloudflare** | DNS 4레코드·프록시 ON·SSL `Full (strict)` | 무한 리다이렉트 또는 전 페이지 무압축 |
| **AdSense 콘솔** | 정치 카테고리 차단 | 이용약관 10항이 **거짓 약속**이 된다 |

#### OAuth 동의 화면 (2026-08-16 갱신)
2026-08-10 리브랜딩 때 **코드 밖이라 같이 안 바뀌어**, 구글 로그인 화면에 `정치 바로미터` 가 계속 떴다.

- 🔴 **Google 프로젝트를 찾는 법 — 클라이언트 ID 앞 숫자가 곧 프로젝트 번호다.**
  `GOOGLE_CLIENT_ID` 가 `520565561407-…` 이므로 **프로젝트 번호 `520565561407`**.
  콘솔 프로젝트 선택기 → 전체 탭 → 이 번호로 검색.
  ⚠️ 계정에 다른 프로젝트가 여럿 있다 (예: `오늘의 행시` — 승인 도메인이 `*.supabase.co` 라 헷갈린다).
  **엉뚱한 프로젝트의 값을 고치면 그 앱의 로그인이 깨진다**
- 위치: Google Auth Platform → **브랜딩** (구 콘솔은 API 및 서비스 → OAuth 동의 화면)
- 등록 값: 앱 이름 `당말사` · 홈페이지 `https://dangmalsa.kr` ·
  개인정보처리방침 `https://dangmalsa.kr/privacy` · 서비스 약관 `https://dangmalsa.kr/terms` · 승인된 도메인 `dangmalsa.kr`
- 로고: **`public/assets/imgs/app-icon-120.png`** (120×120 · 5KB).
  Google 권장 규격이라 이 크기로 따로 만들어 뒀다 — 다른 아이콘은 180/192/512/1024 뿐이다
  - ⚠️ 재생성 시 ImageMagick 없이 만드는 법: `app-icon-512.png` 를 헤드리스 Edge 로 120px 렌더 후 캡처
    (`batch/genInstaCards.js` 와 같은 수법). **`--force-device-scale-factor=1` 필수** —
    없으면 고DPI 장비에서 240×240 으로 찍히는데 눈으로는 멀쩡해 보인다
- ⚠️ 반영에 수 분~수 시간. 캐시된 화면을 보고 "안 바뀌었다" 고 오판하기 쉬우니 시크릿 창으로 확인할 것
- ⚠️ 스코프가 `profile`·`email` 뿐이라(`config/passport.js`) 이름·로고 변경으로 재검증에 들어가지 않는다
- **Kakao 는 별도 콘솔이다** — Kakao Developers → 내 애플리케이션 → 앱 설정 → 일반 → 앱 이름

### Supabase Data API 는 꺼져 있다 (2026-08-12)
Supabase 는 `public` 스키마를 **자동으로 PostgREST 엔드포인트로 노출**한다 (`https://<ref>.supabase.co/rest/v1/…`).
이 API 는 `anon` 키만 있으면 통과하는데 anon 키는 **프론트에 박아 쓰라고 만든 공개용 키**다 —
즉 RLS 가 없으면 키를 아는 사람 누구나 전 테이블을 읽고·쓰고·지울 수 있다.
2026-08-09 보안 어드바이저가 `rls_disabled_in_public` / `sensitive_columns_exposed`(users 의 email·password) 2건을 보냈다.

→ **Project Settings → API → Exposed schemas 에서 `public` 제거** (Data API 토글 OFF). `extensions`·`graphql_public` 도 같이.

- 기능 영향 0 — 이 프로젝트는 PostgREST 를 한 줄도 안 쓴다. `@supabase/supabase-js` 미설치,
  `config/database.js` 가 `pg` 로 pooler(6543) 직결, 인증은 Passport 자체 세션(`auth`/`storage`/`realtime` 스키마 미사용)
- 남는 비밀은 **`DB_PASSWORD` 와 Supabase 계정 두 개**뿐. anon 키는 있어도 갈 곳이 없다
- ⚠️ **RLS 를 켜는 쪽으로 되돌리지 말 것.** 구멍이 남는다 —
  ① **머티리얼라이즈드 뷰는 RLS 문법 자체가 없다** (`politician_cross_party_vote`·`politician_dissent` 가 열린 채 남음)
  ② 일반 뷰는 기본이 definer 권한이라(PG15 `security_invoker` OFF) `bill_analysis_request_counts` 로 아래 테이블 RLS 를 우회
  ③ 테이블을 추가할 때마다 켜줘야 하고 빠뜨리면 같은 경고가 다시 온다.
  Exposed schemas 제거는 **스키마 단위라 이후 생성물까지 커버**된다
- ✅ **2026-08-12 차단 확인** — anon 키로 `users`/`session`/`bills` 등 8종 호출 시 전부 404.
  ⚠️ **키 없이 때리면 노출 여부와 무관하게 항상 401 이라 판별이 안 된다.** `정상키=404 · 오키=401 · 무키=401` 조합이어야 차단 판정.
  설정값은 DB 에서 읽을 수 없다(`pgrst.db_schemas` 비어 있음) — HTTP 로 때려보는 게 유일한 확인 수단
- ⚠️ 경고 메일이 한 주기 더 올 수 있다 (린트 스캔 반영 지연). 며칠 뒤에도 계속 뜨면 그때 재확인
- ⚠️ **`comments`·`likes`·`politician_ratings`·`bill_citizen_votes`·`reports` 의 RLS 정책은 가짜다** —
  `USING(true) WITH CHECK(true)` / 대상롤 `public` / `cmd ALL` 이라 아무것도 막지 않는다.
  Data API 가 꺼져 있어 현재는 무해하지만, **"RLS 켜져 있으니 안전" 으로 오판하지 말 것**
- ⚠️ 노출 시 최고 위험은 `users` 가 아니라 **`session`** 이다 (connect-pg-simple) —
  `sid` 가 곧 쿠키 값이고 `sess` JSON 에 로그인 `userId` 가 있어 읽으면 계정 탈취, 쓰면 세션 위조
- 🔴 **DB 재생성 시 따라오지 않는다** — 타임존 설정과 같은 부류. 빠뜨려도 에러가 없고 조용히 전 테이블이 인터넷에 열린다.
  검증 쿼리·폴백 RLS 스크립트는 `ddl/migrations/2026-08-12-supabase-data-api-off.sql`

### 기술 스택
- Node.js + Express 5.1 + EJS (+ `express-ejs-layouts`)
- PostgreSQL (Supabase) — pg 드라이버
- **Passport** (google-oauth20, kakao) + **express-session** + **connect-pg-simple**
- Railway (배포 완료)
- Claude API (claude-haiku-4-5-20251001) — 법안 분류·AI 법안 분석 (v4 프롬프트, JSON mode)

### 디자인 토큰 (라이트 테마 · 골드 액센트)
```
--bg:      #F7F6F1    메인 배경 (베이지)
--bg2:     #FFFFFF    카드 배경
--bg3:     #EFEDE4    서브 배경
--border:  #E2DFD4 / --border2: #C9C5B6
--text:    #1A1D24 / --sub: #4B5362 / --sub2: #5F6674   # sub2 는 2026-08-16 에 #7A8090 에서 어둡게 (아래)
--accent:  #B8740C    브랜드 골드 (활성/버튼/링크)
--accent2: #925C09    호버
--green:   #0F9D6E / --red: #D03A3A / --purple: #7C3AED   # 객관 데이터 (본회의 가결/부결) 전용
--vote-pro: #7499B4 / --vote-con: #B48E74                  # 국민 찬반 — 등명도(L=58%) 등채도(S=30%), cool/warm 두 hue. 글자는 차콜 (2026-04-26)
--nav-h:   100px      고정 nav 높이 — 데스크톱 (로고행 60 + 메뉴행 40)
--nav-h:    60px      └ 모바일 ≤768px 은 단일 행
```
> 🔴 **`--nav-h` 는 반응형이다. `60px` 을 하드코딩하지 말 것** (2026-08-15).
> 이 문서에 모바일 값만 적혀 있어서 sticky 오프셋 4곳이 전부 `top: 60px` 로 박혀 있었고,
> **데스크톱에서 상단 40px 이 nav 뒤로 들어가** 의원 상세 탭바는 55px 중 15px 만,
> 목록 필터바는 75px 중 35px 만 보였다. 모바일에서만 우연히 맞아 눈치채기 어려웠다.
> 반드시 `top: var(--nav-h)` 로 쓸 것 — 상세는 아래 "고정 헤더(sticky) 구성" 참조.
- 폰트: Noto Sans KR 15px/1.75, `word-break: keep-all`
  - **Noto Serif KR 900** (2026-04-24 추가) — 법안 분석 Zone 1 한 줄 요약·Zone 4 판단 질문 전용
- 공통 CSS: `public/styles/main.css` (`.pb-*` prefix)

#### 🔴 페이지 CSS 는 뷰의 거대한 인라인 `<style>` 한 덩어리다 — 주석을 안 닫으면 **뒤 규칙이 통째로 죽는다**
2026-08-16 에 실제로 냈다. 죽은 CSS 블록을 지우면서 자리에 `/* (… 삭제) ` 라고만 쓰고 `*/` 를 빠뜨렸더니
바로 뒤 **4개 규칙(`.pf-caveat`·`.pf-caveat strong`·`.pf-more`·`.pf-more:hover`)이 주석에 먹혀** 그 부분만
브라우저 기본 스타일로 렌더됐다. 사용자가 "여기만 혼자 스타일이 달라" 로 발견했다.

- 🔴 **에러가 안 난다.** 린터도 없고 빌드도 없어 조용히 렌더만 달라진다.
  다음 `*/` 까지 전부 삼키므로 **몇 십 줄이 한꺼번에** 죽을 수 있다
- **증상 → 원인 순서**: "이 부분만 CSS 가 안 먹는다" 면 **그 규칙 위쪽에 안 닫힌 주석이 있는지부터** 볼 것
- 점검 스크립트 (뷰 전체 + main.css):
  ```js
  // <style> 안에서 /* 를 찾아 다음 */ 까지의 본문에 `{` 가 있으면 규칙을 삼킨 것이다
  const body = css.slice(a, css.indexOf('*/', a + 2));
  if (body.includes('{')) console.warn('규칙을 삼킨 주석', body.slice(0, 60));
  ```
- ⚠️ 스크립트로 CSS 를 편집할 때(정규식·문자열 치환) 특히 잘 난다. **치환 후 위 점검을 돌릴 것**

#### 🔴 `--sub2` 는 #7A8090 → **#5F6674** (2026-08-16). 되돌리지 말 것
구 값은 **어느 배경에서도 WCAG AA(4.5:1)를 못 넘겼다** — 흰색 **3.95** · 페이지 **3.65** · bg3 **3.37**.

- 하필 이 색이 붙은 자리가 **해석 주의·용어 설명 문장**들이었다. 실측 전 뷰 + main.css 에서
  `≤11.5px` 선언 **177개 중 99개가 `--sub2`** — `.kpi-caveat`·`.sp-caveat`·`.vp-trend-note`·`.pc-note` 등
  이 문서가 "**숫자와 세트다 / 빼면 곧바로 오해가 된다**" 고 못박아 둔 그 문구들이
  **사이트에서 가장 작고 가장 옅게** 그려지고 있었다
- ⚠️ **`#646E7E`(`--ba-meta` 에 쓴 값)를 그대로 가져오면 안 된다** — `--bg3`(#EFEDE4) 위에서 **4.40** 으로 여전히 미달.
  세 배경을 다 넘기는 하한이 `#5F6674` 다 (흰색 5.77 · 페이지 5.33 · bg3 **4.92**)
- `--sub`(7.74)와는 여전히 벌어져 있어 2단 위계는 그대로 산다
- ⚠️ `--bg-pending-fg` 도 같이 옮겼다 (`= --sub2` 주석이 붙어 있는데 값만 남으면 조용히 갈린다)
- 실측 검증 2026-08-16: `/bill`(222) · `/politician`(979) · `/politician/:id`(526) · `/briefing`(81) · `/xray`(13)
  의 `--sub2` 텍스트 **전부 4.5:1 통과**, 최악 4.92
  - 🔴 **대비를 잴 땐 알파 배경을 반드시 합성할 것.** `rgba(184,116,12,0.1)` 같은 틴트를 불투명으로
    취급하면 `.pb-help` 가 **1.52** 로 나온다 (실제 5.6). 감사 스크립트를 처음 그렇게 짜서 오탐을 냈다

#### 문장형 설명은 **12px 하한** (2026-08-16)
같은 감사에서 나온 규칙. 화면에서 읽혀야 하는 **문장**은 12px 아래로 내리지 않는다.

| | 크기 | 예 |
|---|---|---|
| 문장형 설명·해석 주의 | **12px 이상** | `.kpi-caveat` · `.sp-caveat` · `.vp-trend-lede` · `.vp-trend-note` · `.pc-note` · `.pc-foot` · `.vp-note` · `.vp-bandkey li` · `.vote-tally-note` |
| 라벨·메타 (단어 1~2개) | 10~11px 허용 | `.sp-mt-meta` · `.vtd-r` · `.pv-map` |
| mono 수치·축 눈금 | 9~10px 허용 | `.vp-trend-ml` · `.vp-trend-axis i` |

- ⚠️ **`.profile-kpi-lead`(11.5px)는 일부러 안 올렸다** — `발의 885건 중 87건이 대표 9.8%` 가
  375px 2열 카드 내부 **111px** 에 겨우 들어간다. 올리려면 폭부터 다시 잴 것
- ⚠️ `.vp-bandkey li` 를 11 → 12 로 올리면 `repeat(auto-fit, minmax(118px, 1fr))` 하한 계산이 흔들린다.
  실측 375px 2열에서 138px 이라 통과했지만(클립 0), 라벨을 늘릴 땐 다시 잴 것
- ⚠️ **320px 에는 원래부터 넘침이 있다** (`profile-kpis-row` 301/272 · `monthly-chart` 255/226).
  폰트 변경 **전후가 동일**해 이번 건과 무관함을 확인했다. 이 프로젝트의 실측 하한은 375px 이다

### 공용 페이지 헤더 `.pb-page-header`
`main.css` 에 정의된 섹션 타이틀 블록. 모든 목록/랜딩 페이지가 동일 컨셉으로 쓰도록 통일.
- 트릭: `margin-top: calc(-1 * var(--nav-h))` + `border-top: var(--nav-h) solid transparent` — 그라디언트 배경이 고정 nav 뒤까지 바닥부터 뻗음
- 내부: `.pb-page-header-inner { flex; justify-content: space-between; align-items: flex-end }` — 좌측 `.pb-page-title` (Bebas Neue 44px) + `.pb-page-desc` (desc 14px), 우측에 액션 버튼(예: 커뮤니티 글쓰기) 배치 가능
- 적용 페이지: `/bill`, `/politician`, `/glossary`, `/community`, `/about`
- Breadcrumb 정책: **목록/랜딩은 미노출** (nav 의 active 상태로 충분), 상세/sub 페이지(`/bill/:id`, `/politician/:id`, `/community/:id`, `/community/write`) 만 노출
- Wrapper padding 통일: page-header 를 쓰는 페이지의 본문 wrapper 는 `padding: 36px 24px 80px` (nav 오프셋은 header 가 처리), page-header 없는 페이지(`bill_detail`, `community/detail`, `community/write`) 는 `padding: calc(var(--nav-h) + 36px) 24px 80px` 로 직접 처리

### 고정 헤더(sticky) 구성 — `.sticky-head` (2026-08-15)
목록 두 곳이 **검색바 + 탭** 두 줄을 nav 아래에 붙여둔다. 둘을 **한 컨테이너로 묶어 통째로** sticky 시킨다.

| 페이지 | 묶는 것 |
|---|---|
| `/bill` | `.filter-bar`(검색) + `.status-tabs`(전체·계류·원안가결…) |
| `/politician` | `.filter-bar`(검색) + `.party-tabs`(전체·정당별) |

```
.sticky-head { position: sticky; top: var(--nav-h); z-index: 50; }
.sidebar     { top: calc(var(--nav-h) + var(--filter-bar-h) + var(--status-tabs-h)); }
```

- 🔴 **둘을 따로 sticky 시키지 말 것.** 탭의 `top` 을 `nav + 검색바높이` 로 계산해야 하는데
  **모바일 검색바는 높이가 유동적이다** — 내용이 2~3줄로 접혀 실측 `/bill` 768px→129 · 409px→180,
  `/politician` 은 최대 233px 까지 간다. 어떤 고정값을 넣어도 그 폭에서 탭이 검색바 뒤로 숨는다.
  묶으면 높이 계산이 sticky 경로에서 통째로 사라져 **어느 폭에서도 맞는다**
- ⚠️ `--filter-bar-h`(75px) · `--status-tabs-h`(57px) · `--party-tabs-h`(51px) 는 **데스크톱 실측값이고
  사이드바 위치 계산에만 쓴다.** 모바일은 사이드바가 바텀시트(`position: fixed`)라 관여하지 않는다
- ⚠️ 상태 탭 57 ≠ 정당 탭 51 — 전자는 `<a>`, 후자는 `<button>` 이라 패딩이 다르다. **값을 복사하지 말 것**
- 실측 고정 크롬: 데스크톱 231px(1280×800 의 29%) / 모바일 240~278px(30~31%)

---

## DB 스키마 (PostgreSQL / Supabase)

### 트리거 함수
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 공공데이터 기반 테이블
- `code_groups`, `codes` — 공통코드 (BILL_TOPIC 16종 분류, 현재는 committee 단일 기준으로 대체)
- `parties`, `party_names_history` — 정당
- `politicians` — 의원 (mona_cd UNIQUE)
  - ⚠️ **현직 22대 의원만 저장** (2026-08-04 현재 299명). `syncPoliticians.js` 가 열린국회 "현역 의원 API" 기반이라 중도 퇴임·사직·당선무효·사망·승계 등으로 빠진 ~11명은 미포함
  - 결과: `bill_votes` / `bill_co_proposers` 에 해당 mona_cd 기록은 남아있지만 JOIN miss → 이름·정당·사진 렌더 불가. UI 는 "(퇴임)" fallback 으로 처리 (voter-list / proposer-chip)
  - 근본 해결은 "역대 국회의원 API" 전환 — [ROADMAP.md](./ROADMAP.md) 베타 오픈 전 필수 3번
  - **`active_yn` — 한때 있었지만 지금 현역 API 에 없는 사람** (실측 10명, 위 "없는 11명" 과 별개다)
    - `syncPoliticians` 가 API 응답에 없는 mona_cd 를 `FALSE` 로 내린다. 다시 나타나면 UPSERT 가 `TRUE` 로 되돌린다
    - 실측 10명(추미애·권성동·박찬대·추경호·전재수·민형배·위성곤·이원택·박수현·김상욱)은
      **지역구가 10개 광역단체와 하나씩 대응**하고 마지막 표결이 전부 `2026-04-23`(현직은 `2026-07-23`)이다
      → 2026-06 지방선거 출마 사퇴로 보이지만 **원천이 사유를 주지 않는다. 화면에 이유를 쓰지 말 것**
    - 🔴 **의원 목록은 `active_yn` 으로 거르지 않는다** (2026-08-14 변경). 거르면 22대에서 실제로
      활동한 기록이 있는 사람이 통째로 사라진다 — 상세 페이지는 원래 열려 있어서 목록만 막힌 상태가 더 이상했다.
      화면에서 `퇴임` 배지로 구분한다 (무채색 외곽선 — 상태지 평가가 아니므로 정당색 금지)
    - ⚠️ **목록과 사이드바 카운트 5종을 같이 풀어야 한다** (`getListWithStats` + `getPartyCounts`·
      `getCommitteeCounts`·`getElectTypeCounts`·`getGenderStats`·`getAgeGroupStats`).
      한쪽만 풀면 "정당 169" 라고 써놓고 카드는 더 나온다
    - ⚠️ **`/xray`·홈 KPI·차트·admin 은 `active_yn = TRUE` 를 유지한다** — 그쪽은 "현재 국회" 를
      묻는 통계라 퇴임자가 섞이면 답이 틀린다. 목록만 기록 보관소 성격이다
- `politician_party_memberships` — 의원-정당 이력
- `briefing_posts` — **브리핑 카드** (2026-08-11, `genBriefing.js`). `briefing_date` UNIQUE 라 하루 1장.
  `stats`(SQL 집계) · `threads`(주제 묶음, v2) · `keywords` · `bill_ids` JSONB. 상세는 아래 "`/briefing` AI 카드 피드"
  - ⚠️ `id` 가 **연속하지 않는다** — `GENERATED ALWAYS AS IDENTITY` 가 ON CONFLICT 판정 전에 값을 뽑아 `--force` 재실행이 시퀀스를 태운다
  - ⚠️ `stats`·`threads[].bill_count` 는 **AI 출력이 아니라 SQL/코드 산출값**이다 (숫자를 생성물에서 받지 않는다는 원칙)
- `politician_speeches` — **의원 발언 기록** (2026-08-12 적재 · 2026-08-15 배치 재작성, `batch/syncSpeeches.js`). 실측 **66,882행 / 의원 309명 / 2024-06-05~2026-08-14**
  - 존재 이유: 기존 축(발의·표결·가결률)이 전부 본회의·법안 기준이라 **상임위가 안 보였다.** 이 데이터는 회의의 73%가 위원회·국감이다
  - **`role_kind` 5종** (2026-08-15 구 `gov` 3분할, `ddl/migrations/2026-08-15-speeches-role-kind-split.sql`):

    | 값 | 실측 | 뜻 | 화면 |
    |---|---|---|---|
    | `member` | 40,386 | 질의석 — 위원·간사·의원 | ✅ |
    | `chair` | 21,591 | 위원장석(사회) — 안건 호명 | ✅ (분리 표시) |
    | `government` | 4,354 | 정부측 (장관·차관·청장…) | ❌ |
    | `other` | 548 | 도지사·교수·회장·사장 등 | ❌ |
    | `witness` | 3 | 참고인·증인·진술인 | ❌ |

  - 🔴 **집계는 `member`·`chair` 만 한다.** 소스가 MONA_CD 를 주지 않아 **이름으로만 매칭**하는데,
    `위원장`·`위원`·`간사` 는 국회의원만 가질 수 있어 이름 충돌이 구조적으로 없는 반면
    그 밖의 직위는 외부인이 가질 수 있어 **동명이인 오귀속**이 섞인다
    (실측: 도지사 김영환 87건 · 회장 김병주 21건 · 변호사 김종민 15건 · 교수 박은정 7건 — 전부 다른 사람)
    - ⚠️ `government` 안에도 오귀속이 있다 (김문수 고용노동부장관 88건 — 동명의 현역 의원이 따로 있다).
      **세분했으니 쓸 수 있게 된 게 아니라, 왜 못 쓰는지를 기록으로 남긴 것**이다
    - ⚠️ 3분할 이전엔 화면에 `국무위원석 답변` 이라고 라벨을 붙여 **참고인 1건짜리 의원이 장관처럼 표시됐다.** 되돌리지 말 것
  - 🔴 **`member` 와 `chair` 를 합치지 말 것** — 위원장은 안건을 호명하느라 발언이 구조적으로 많다
    (실측 서영교 위원장석 680건 vs 질의석 365건). 합치면 "위원장을 맡았다" 가 "말을 많이 했다" 로 둔갑한다
  - ⚠️ `rec_sec` 은 개인 발언시간이 아니다 (한 클립에 질의+답변이 함께 녹화). 비교엔 건수를 쓸 것
  - ⚠️ 비교 시 `politician_committees` 소속으로 정규화할 것 — 위원회마다 회의 빈도가 다르다
- `politician_titles` — **의원 특수 직위** (2026-08-12 신규). 의장단·국무위원·교섭단체·당직 4종. **전부 수동 입력** (`ddl/seeds/politician_titles.sql`) — 자동 수집 경로가 없다. 상세는 아래 "특수 직위 배지" 참조. ⚠️ 상임위 직위는 여기가 아니라 `politician_committees`
- `politician_committees` — **위원회 위원 명단** (2026-08-12 신규, `syncCommittees.js`). 실측 477행 / 23개 위원회 / 의원 298명(1~6개 중복 소속) / 미소속 11명
  - 소스 `nktulghcadyhmiqxi` 가 **`MONA_CD` 를 직접 준다** — 이름 매칭이 필요 없다 (발언영상 API 는 이름 문자열만 줘서 파싱이 필요한 것과 대조)
  - ⚠️ **현재 스냅샷이지 이력이 아니다.** API 에 대수·기간 인자가 없다. 배치가 매번 전체 교체하므로 "과거에 어느 위원회였나" 는 이 테이블로 답할 수 없다 — 그건 `politician_committee_history` 가 맡는다 (아래). 이걸 UPSERT 로 바꾸면 사임한 위원이 영원히 남으니 되돌리지 말 것
- `politician_committee_history` — **위원회 소속 관측 이력** (2026-08-15 신규). `syncCommittees` 가 전체 교체 **전에** 스냅샷을 비교해 변경분만 기록한다. 외부 호출 0회
  - 존재 이유: 스냅샷만으로는 "언제 배정됐나" 를 몰라 **상임위 참여율의 분모를 정할 수 없었다.** 원천이 안 주므로 **우리가 매일 보고 차이를 적는다**
  - 🔴 **공식 배정 기록이 아니라 관측 기록이다.** `started_on` 은 "명단에서 처음 본 날" 이다 (최대 하루 오차 + 배치가 멈춘 기간만큼). 화면에 "배정일" 이라고 쓰지 말 것
  - 🔴 **최초 적재분(시드 477행)은 `started_on = NULL` · `is_seed = TRUE`.** 오늘 명단엔 2024년부터 있던 사람과 지난주 배정자가 섞여 있는데 구분할 방법이 없다. 여기에 오늘 날짜를 찍으면 **전원이 "오늘 배정" 이 되어 분모가 0에 수렴하고 참여율이 통째로 망가진다.** 소비하는 쪽(MV)이 `is_seed` 를 보고 근사로 폴백한다
  - ⚠️ **`ended_on` 에 오늘이 아니라 `last_seen` 을 찍는다** — 배치가 며칠 멈췄다면 "어제까지 있었다" 고 단정할 수 없다
  - ⚠️ **위원→간사 승격은 구간을 끊지 않고 `job_res_nm` 만 갱신한다.** 끊으면 참여율 분모가 조각나 "간사 된 뒤 3번 중 3번" 같은 표본 3짜리가 생긴다. 대신 "언제 간사가 됐나" 는 답할 수 없다
  - ⚠️ 열린 구간은 쌍당 하나 (`ux_pch_open` 부분 UNIQUE). 없으면 배치 중복 실행이 구간을 복제한다
  - 타이밍: **22대 후반기 원구성 직후에 시작**했다 (현 소속 위원회 첫 발언이 2026-07 에 137명·08 에 48명 — 477쌍의 39%가 최근 두 달). 이번 임기 내내 정확한 분모를 갖는다
  - 진행 상황은 `refreshCommitteeSpeech` 로그의 `[시작일] 이력 기준 N/388` 로 본다 (도입 시점 0%)
  - ⚠️ **politicians 로의 FK 를 걸지 않았다.** politicians 는 현직만 담아서, 승계·보선으로 아직 없는 의원이 명단에 뜨면 FK 가 트랜잭션 전체를 깨뜨려 **명단이 통째로 비워진다**. `bill_votes` 가 mona_cd 를 FK 없이 들고 있는 것과 같은 판단
  - ⚠️ 배치에 `MIN_EXPECTED = 300` 안전장치가 있다. 전체 교체 방식이라 API 가 부분 실패하면 DELETE 만 되고 명단이 사라진다
  - ⚠️ **`politicians.cmit_nm` / `cmits` 는 죽은 컬럼이다** — 309명 전원 NULL. `syncPoliticians` 가 쓰는 현역의원 API 가 위원회를 안 준다. 이 컬럼들을 쓰지 말 것 (상세 페이지에 `cmit_nm` 분기가 있었으나 렌더된 적이 없어 2026-08-12 제거)
- `bills` (PK bill_id VARCHAR), `bill_co_proposers`, `bill_votes` — 법안·발의자·표결
  - **처리 단계 날짜 9종** (2026-08-11 추가) — `syncBills` 가 쓰는 API(`nzmimeepazxkubdpn`)가 **원래부터 주던 값**인데 받아놓고 버리고 있었다. 저장만 하면 되므로 **추가 API 호출 0회 · 새 배치 0개 · 전건 소급**
    ```
    propose_dt → committee_dt → cmt_present_dt → cmt_proc_dt(+cmt_proc_result)
               → law_submit_dt → law_present_dt → law_proc_dt(+law_proc_result) → proc_dt
       발의        소관위 회부      위원회 상정      위원회 처리
                   법사위 회부      법사위 상정      법사위 처리                     본회의 의결
    ```
    - 실측 채움: 소관위 회부 18,639 / 위원회 상정 14,397 / 위원회 처리 4,914 / 법사위 처리 601 / **본회의 의결 4,541**
    - `proc_dt` 는 `proc_result_name` 이 있는 4,541건과 **정확히 1:1** — "언제 처리됐나" 를 이걸로 답한다
    - ⚠️ **상태 변경 이력 테이블(`bill_status_history`)은 만들지 않았다.** 이력 테이블은 만든 시점부터만 쌓이지만 이 컬럼들은 과거까지 소급된다
    - ⚠️ 컬럼명에서 `_cd` 를 뺐다 — API 필드는 `CMT_PROC_RESULT_CD` 지만 값은 코드가 아니라 텍스트('원안가결')다
    - ⚠️ `ALLBILL` API 에도 같은 정보 + 공포일이 있지만 **`BILL_NO` 필수라 벌크 조회가 안 된다** (18,671콜). 반드시 `nzmimeepazxkubdpn` 을 쓸 것
  - `bills.summary` — 국회 공식 **"제안이유 및 주요내용" 원문** (2026-08-11 추가, `syncBillSummary.js`). 전체 18,671건 중 **18,631건(99.79%) 보유**, 11MB. 길이 140~10,349자(중앙값 498)
    - ⚠️ `bill_ai_analysis.summary` 와 **다른 것**. 이쪽은 가공 없는 원문(관 문체, "~하고자 함")이고 **전건** 보유. AI 분석은 쉬운 말·찬반 쟁점이고 요청·가결 건만
    - 빈 40건은 전부 `대안반영폐기`·`철회` — 국회가 요약을 공표하지 않은 건이라 정상. 재시도해도 안 채워짐
    - ⚠️ 본문 첫 줄에 `제안이유 및 주요내용` 또는 `제안이유` 머리말이 포함돼 있다. UI 표시 시 제거 필요
  - `bill_co_proposers.proposer_yn=1` 이 여러 행인 경우 = 공동 대표발의. `bills.mona_cd` / `proposer_name` 은 첫 번째 대표만 저장 (2026-04-24)
- `temp_*` — 배치용 staging (현재 미사용)

### 사용자 / 상호작용 테이블

```sql
-- users: OAuth 대응으로 NULL 허용 + 통계용 컬럼 추가
CREATE TABLE users (
  user_id     INT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       VARCHAR(255) UNIQUE,           -- NULL 허용 (카카오 비즈 미승인 시)
  nickname    VARCHAR(100) UNIQUE,           -- NULL 허용 (탈퇴 익명화)
  password    VARCHAR(255),
  provider    VARCHAR(50)  DEFAULT 'local',  -- 'local' | 'google' | 'kakao' | 'deleted'
  provider_id VARCHAR(255),
  gender      VARCHAR(10)  NOT NULL,         -- 'male' | 'female' | 'other'
  age_group   VARCHAR(10)  NOT NULL,         -- '10s' ~ '60s'
  welcomed_at TIMESTAMPTZ,                   -- 가입 직후 환영 페이지 1회 노출 (2026-04-26)
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE UNIQUE INDEX ux_users_provider
  ON users (provider, provider_id)
  WHERE provider_id IS NOT NULL;

-- 댓글 (정치인/법안/게시글 공용)
CREATE TABLE comments (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('politician','bill','post','briefing')),
  target_id   VARCHAR(50)  NOT NULL,   -- mona_cd | bill_id | post.id(text)
  parent_id   BIGINT       REFERENCES comments(id) ON DELETE CASCADE,
  user_id     INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content     TEXT         NOT NULL,
  is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
-- idx_comments_target / user / parent + trg_comments_updated_at

-- 의원 별점 (1인 1평가)
CREATE TABLE politician_ratings (
  id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  politician_id  VARCHAR(50) NOT NULL,            -- mona_cd
  user_id        INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  score          SMALLINT    NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (politician_id, user_id)
);

-- 법안 국민 찬반 (국회의원 표결과 별개)
CREATE TABLE bill_citizen_votes (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bill_id     VARCHAR(50) NOT NULL REFERENCES bills(bill_id) ON DELETE CASCADE,
  user_id     INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  vote        VARCHAR(10) NOT NULL CHECK (vote IN ('agree','disagree')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bill_id, user_id)
);

-- 좋아요 (토글, 댓글·게시글·브리핑 공용)
-- ⚠️ target_id 가 **INTEGER** 다 (comments 는 VARCHAR). 2026-08-11 실측으로 확인 —
--    이 문서에 VARCHAR(50) 으로 적혀 있었으나 실제 스키마와 달랐다.
--    그래서 likes 는 bill_id('PRC_…')·mona_cd 같은 문자열 키를 담지 못한다 (숫자 PK 대상만).
CREATE TABLE likes (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('comment','post','briefing')),
  target_id   INTEGER      NOT NULL,
  user_id     INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (type, target_id, user_id)
);

-- 커뮤니티 게시글
CREATE TABLE posts (
  id              BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         INT          REFERENCES users(user_id) ON DELETE SET NULL,
  title           VARCHAR(200) NOT NULL,
  content         TEXT         NOT NULL,
  linked_bill_id  VARCHAR(50)  REFERENCES bills(bill_id) ON DELETE SET NULL,
  view_count      INT          NOT NULL DEFAULT 0,
  is_deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- 세션 (connect-pg-simple 자동 생성 가능)
CREATE TABLE "session" (
  "sid"    VARCHAR PRIMARY KEY,
  "sess"   JSON    NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

### AI 법안 분석 테이블 (2026-04-24 신규, 2026-04-26 v4.1 카테고리 2-tier)

```sql
-- 5-Zone UI 구조에 직접 매핑되는 JSONB 중심 테이블
CREATE TABLE bill_ai_analysis (
  bill_id              VARCHAR(50) PRIMARY KEY REFERENCES bills(bill_id) ON DELETE CASCADE,
  summary              TEXT        NOT NULL,      -- Zone 1 한 줄 요약
  category             VARCHAR(50),               -- Zone 1 태그 (legacy, deprecated — DROP 예정)
  category_main        VARCHAR(50),               -- v4.1: 16종 고정 set 중 1개 (필터·집계용)
  category_sub         VARCHAR(50),               -- v4.1: 자유 형식 10자 이내 (카드 표시용, NULL 허용)
  reading_time_min     SMALLINT    DEFAULT 2,     -- Zone 1 "읽기 N분"
  changes              JSONB       NOT NULL,      -- Zone 2 {current, revised, clause}
  affected             JSONB       NOT NULL,      -- Zone 2 {benefit, loss, direct[], indirect[]}
  issues               JSONB       NOT NULL,      -- Zone 3 [{type, title, body}] — type: pro|con|gap
  context              JSONB,                     -- Zone 5 참고 맥락 (미구현)
  limitations          JSONB,                     -- Zone 5 분석 한계 (미구현)
  judgment_questions   JSONB       NOT NULL,      -- Zone 4 [{question, hint}]
  model                VARCHAR(50) NOT NULL,      -- 예: claude-haiku-4-5-20251001
  prompt_version       VARCHAR(10) NOT NULL,      -- 'v4' (자유 카테고리) | 'v4.1' (16종 main+sub) | 'v4-sample' (수동 시드)
  tokens_input         INT,
  tokens_output        INT,
  cost_usd             NUMERIC(8,6),              -- 건당 비용 추적
  needs_review         BOOLEAN     DEFAULT FALSE, -- 사실 오류 의심 플래그 (16종 외 카테고리·연도/기관 다수·limitations 3개+)
  review_status        VARCHAR(20) DEFAULT 'auto',-- auto|human_approved|human_rejected
  analyzed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
-- 인덱스: prompt_version / needs_review(partial WHERE TRUE) / category / category_main
-- 트리거: trg_bill_ai_analysis_updated_at
```

**v4.1 카테고리 16종 고정 set** (`batch/billCategories.js` 에 정의·tie-breaker 모듈로 분리):
```
정치·행정 / 외교·통일 / 국방·안보 / 사법·치안
산업·R&D  / 조세·재정 / 노동·고용 / 교육·인재
환경·에너지 / 보건·의료 / 복지·돌봄 / 주거·국토
농어촌·수산 / 문화·예술 / 안전·재난 / 유통·소비자
```
- `category_main` 은 16종 글자 그대로만 허용. 검증 실패 시 `needs_review=true` 강제
- `category_sub` 예: "양자기술", "환경교육", "소상공인" — 카드에 "산업·R&D · 양자기술" 형태로 표시
- 모호 케이스 결정 가이드: 직접적 변경 대상(수단보다 결과) → 주관 부처 → 일반 국민 검색 멘탈모델 순. 예: "환경교육법 → 환경·에너지", "소상공인 지원법 → 노동·고용", "양자과학기술법 → 산업·R&D"
- legacy `category` 컬럼은 안정화 1주 후 DROP 예정

### 분석 요청 테이블 (2026-04-25 신규)

```sql
-- 미분석 법안에 대한 사용자의 1인 1요청
CREATE TABLE bill_analysis_requests (
  id            BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bill_id       VARCHAR(50)  NOT NULL REFERENCES bills(bill_id) ON DELETE CASCADE,
  user_id       INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  requested_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (bill_id, user_id)
);
-- idx_bill_analysis_requests_bill / user / recent (DESC)

-- 카운트 view (리스트 LEFT JOIN 시 사용)
CREATE OR REPLACE VIEW bill_analysis_request_counts AS
SELECT bill_id, COUNT(*)::int AS request_count, MAX(requested_at) AS last_requested_at
  FROM bill_analysis_requests GROUP BY bill_id;
```
- 임계값(`ANALYSIS_REQUEST_THRESHOLD`, 기본 5) 도달 시 카드/위젯에 "🔥 우선 분석 대기" 표시 + 위젯에 "🎉 충분한 요청이 모였어요" 메시지
- 운영자 우선순위 쿼리: `WHERE a.bill_id IS NULL` + `ORDER BY rc.request_count DESC` 로 다음 분석 큐 결정
- 또는 UI 로: `/bill?has_analysis=N&request_status=any&sort=requested`

### codes 테이블 데이터 (BILL_TOPIC, 레거시)
> 현재는 `bills.committee` 단일 기준으로 대체됨. BILL_TOPIC 코드는 유지만 하고 조회에는 미사용.

```
1:보건/복지/의료  2:교육/인재/학술  3:노동/고용/자영업  4:국토/도시/주택
5:환경/기후/에너지  6:농림축산/수산/해양  7:조세/재정/금융  8:산업/기술/R&D
9:행정/공공/사법  10:안보/국방/병무  11:문화/체육/예술  12:안전/재난/소방
13:통일/외교/남북  14:정치/선거/규제  15:유통/소비자/공정
16:기타  999:미지정
```

### 회원 탈퇴 (익명화 방식)
```sql
UPDATE users SET email=NULL, nickname=NULL, provider='deleted',
                 provider_id=NULL, password=NULL
 WHERE user_id = $1
-- gender/age_group 은 보존 (통계 집계 목적)
-- provider_id NULL 로 복합 UNIQUE 충돌 없음 → 같은 소셜 계정으로 재가입 가능
```

### DDL 파일 위치
`etc/ddl/` — 모든 스키마 변경이 여기 기록됨
> ⚠️ 2026-08-04 확인: 저장소에 실재하는 건 루트의 `ddl/` (git 추적 X, 현재 비어 있음). 아래 `etc/ddl/*` 파일들은 저장소에 없음 — 로컬에만 있거나 유실. 신규 마이그레이션은 `ddl/migrations/` 에 작성 중
- `users_update.sql`, `comments.sql`, `politician_ratings.sql`,
  `bill_citizen_votes.sql`, `likes.sql`, `posts.sql`, `user_session.sql`,
  `bill_ai_analysis.sql` (2026-04-24 신규 — 샘플 INSERT 포함),
  `bill_analysis_requests.sql` (2026-04-25 — 분석 요청 테이블 + view)
- `etc/ddl/migrations/` — 누적 변경
  - `2026-04-26-bill-category-tier.sql` — `bill_ai_analysis` 에 `category_main`/`category_sub` 컬럼 추가
  - `2026-04-26-balance-game.sql` — 밸런스 게임 4테이블 1차 (이후 cumulative 마이그레이션이 응답 테이블 재설계)
  - `2026-04-26-balance-game-cumulative.sql` — **누적 모델 v2**. `balance_game_packs` / `user_axis_score` / `group_axis_avg` 신규, `balance_game_responses` 1문항 단위 재설계, `balance_game_questions` 에 `pack_id`/`display_order`, `bill_axis_mapping.mapped_by` 타입 변경, `users.welcomed_at`. 종합팩 'general' + 20문항 시드 포함
  - `ddl/migrations/2026-08-04-batch-incremental.sql` — **배치 증분화**. `bills.vote_synced_at` 컬럼 + 부분 인덱스, `batch_runs` 테이블 (배치 실행 기록 · nav 갱신 배지 소스 · 크론 실패 추적)
  - `ddl/migrations/2026-08-05-cross-party-vote-mv.sql` — **교차 표결 성향 MV**. `politician_cross_party_vote` + UNIQUE 인덱스(CONCURRENTLY 갱신용) + `gap` 부분 인덱스
  - `ddl/migrations/2026-08-10-dissent-mv.sql` — **당론 이탈 MV**. `politician_dissent` + UNIQUE 인덱스 + `dissent_rate` 인덱스. "숫자로 본 국회" 최대 병목(1,410ms)이었던 `getDissentRank` 를 45ms 로
  - `ddl/migrations/2026-08-11-bill-stage-dates.sql` — **법안 처리 단계 날짜 9종**. `proc_dt`(본회의 의결일) 등 + 부분 인덱스 + 트리거 `ROW(...)` 목록 갱신. ⚠️ 실행 순서: 마이그레이션 → `syncBills` → 파일 하단의 `analyzed_at` 정리 쿼리
  - `ddl/migrations/2026-08-11-bills-updated-at-trigger.sql` — **`bills` 전용 updated_at 트리거**. 공용 `update_updated_at()` 이 부기 컬럼 UPDATE 에도 `updated_at` 을 밀어 증분 배치 2종을 깨뜨린 문제 수정 (위 "⚠️ `bills.updated_at` 은 트리거가 지킨다" 참조)
  - `ddl/migrations/2026-08-11-bill-name-index.sql` — **동명 법안 계열 카운트용 btree**. `idx_bills_bill_name_btree`
    - ⚠️ **`idx_bills_bill_name` 이라는 이름은 이미 전문검색용 GIN(`to_tsvector('simple', bill_name)`)이 쓰고 있다.** 등치 비교에 못 쓴다
    - ⚠️ `CREATE INDEX IF NOT EXISTS` 는 **정의가 아니라 이름만** 본다 — 같은 이름으로 만들면 에러 없이 무시되고 btree 는 끝내 안 생긴다. 실제로 이 함정에 걸려 `enable_seqscan=off` 로도 Seq Scan 이 나왔다. 인덱스 추가 전 `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='bills'` 로 확인할 것
    - 효과: 계열 COUNT 6ms(Seq Scan) → **1.5ms(Index Only Scan, Heap Fetches 0)**. 목록 쿼리에서 서브쿼리 50회 비용 170ms → **6ms**. `?bill_name=` 필터 349ms → 100ms
  - `ddl/migrations/2026-08-11-bill-summary.sql` — **법안 제안이유·주요내용**. `bills.summary` + `bills.summary_synced_at` + 부분 인덱스(`WHERE summary_synced_at IS NULL`). 미분석 법안이 목록·상세에서 내용이 아예 없던 문제 해소 (전체의 87%가 동명 법안이라 카드 구분 불가였음)
  - `ddl/migrations/2026-08-06-db-timezone-kst.sql` — **DB 세션 타임존 KST**. `ALTER DATABASE postgres SET timezone`. ⚠️ DB 재생성 시 반드시 재실행 (빠뜨려도 에러 없이 시각이 9시간 밀림)
  - `ddl/migrations/2026-08-12-politician-speeches.sql` — **의원 발언 기록 테이블**. 2026-08-15 에 **라이브 스키마에서 복원**한 것 (원본 유실). `(clip_id, mona_cd)` UNIQUE + mona/date/mona_kind 인덱스 3종
  - `ddl/migrations/2026-08-15-speeches-role-kind-split.sql` — **`role_kind` 구 `gov` 를 `government`/`witness`/`other` 로 3분할** + CHECK 제약. ⚠️ **`syncSpeeches.js --full` 을 먼저 돌린 뒤** 실행할 것 (값을 바꾸는 건 배치고 이 파일은 제약·주석만 건다)
  - `ddl/migrations/2026-08-15-committee-history.sql` — **위원회 소속 관측 이력** `politician_committee_history` + 현재 명단 시드(477행, `is_seed=TRUE`). ⚠️ 시드에 오늘 날짜를 찍지 말 것 (위 테이블 항목 참조)
  - `ddl/migrations/2026-08-16-bill-axis-mapping-v2.sql` — **법안-축 매핑 v2 · 3축**. `bill_axis_mapping` PK → `(bill_id, mapping_version)`, `politician_axis_score` 축 컬럼 NULL 허용 + `*_n` 서명 수, 파일럿 테이블에서 4,854건 적재. ⚠️ 실행 후 `calcPoliticianAxis.js` 를 돌려야 좌표가 생긴다
  - `ddl/migrations/2026-08-15-committee-speech-mv.sql` — **상임위 발언 참여율 MV** `politician_committee_speech`. 소속기간으로 정규화한 참여율 + 코호트 판정. **어떤 대안을 왜 버렸는지가 파일 주석에 전부 있다** — 되돌리기 전에 읽을 것
    - ⚠️ **LIKE 조인 위치가 성능을 좌우한다.** `politician_committees`(477) × `politician_speeches`(66,882) 를 LIKE 로 붙이면 3,200만 번 평가돼 **15초**, 회의↔위원회를 먼저 매칭해두고 등치 조인하면 **2.4초**. 결과는 동일
  - `ddl/migrations/2026-08-12-supabase-data-api-off.sql` — **Supabase Data API 노출 차단**. 실행할 SQL 이 아니라 **대시보드 설정의 기록** + 검증 쿼리 + 폴백 RLS 스크립트. ⚠️ DB 재생성 시 반드시 재설정 (빠뜨려도 에러 없이 전 테이블이 인터넷에 열림). 위 "Supabase Data API 는 꺼져 있다" 참조
- `etc/ddl/seeds/` — 데이터 시드
  - `bill_axis_mapping_v1.sql` — 법안-축 매핑 v1 (AI 1차 매핑 48건, 사용자 1라운드 검토 반영). **2026-08-16 v2(4,854건 · `ddl/migrations/2026-08-16-bill-axis-mapping-v2.sql`)로 대체됨** — 검토 표본은 `BILL_AXIS_MAPPING_v2_REVIEW.md`. `BILL_AXIS_MAPPING_GUIDE.md` 는 v1 기준 문서
- `balance_game_seed_v1.sql` (root) — 밸런스 게임 60문항 시드 (종합 20 + 노동 10 + 부동산 10 + 안보 10 + 젠더 10). 별도 받아온 외부 시드 파일이라 root 에 위치

---

## 라우트 구조

### 페이지 (EJS 렌더링)
| 경로 | 뷰 | 설명 |
|---|---|---|
| `/` | `views/index.ejs` | 홈 (결론 3칸, 국회 브리핑, 나와 맞는 의원, 주목 법안, 숫자로 본 국회) |
| `/briefing` | `briefing/feed.ejs` | **브리핑 피드** — AI 카드가 하루 단위로 쌓인다 + 상단 주간 요약 스트립. `?page=N` (20건/페이지) |
| `/briefing/:id` | `briefing/post.ejs` | 브리핑 카드 상세 — **댓글·공유의 단위**. 그날 숫자 · 대표 법안 · 키워드별 뉴스 검색 링크 |
| `/briefing/:id/card` | `briefing/card.ejs` | **인스타 카드** (1080×1350 캐러셀). `layout:false`. `?slide=N` 이면 그 장만 1:1 |
| `/briefing/:id/threads` | `briefing/threads.ejs` | **쓰레드 연결 게시물** — 500자 단위로 쪼갠 체인 + 게시물별 복사 버튼 |
| `/politician` | `politician/politician.ejs` | 의원 목록 (정당 히스토그램, 그리드/리스트 토글, 사이드바 복수선택 필터) |
| `/politician/:id` | `politician/politician_detail.ejs` | 의원 상세 (분석·법안·표결·국민평가 탭, 분석이 기본) |
| `/bill` | `bill/bill.ejs` | 법안 목록 (AI 분석 진행률 배너 + 통합 필터 카드 + 정렬 + 카테고리·정당 복수선택, 페이징) |
| `/bill/:id` | `bill/bill_detail.ejs` | 법안 상세 (AI 분석 5-Zone·요청 위젯·국민 찬반·본회의 표결·댓글) |
| `/xray` | `xray/xray.ejs` | **숫자로 본 국회** (nav 라벨 **"차트"**, 2026-08-11 변경) — 기본 지표 **12종** 아코디언 + 우측 상단 `직접 만들어보기` 진입 |
| `/xray/s/:id` | `xray/sections/*.ejs` | 섹션 HTML 조각 (layout 없음). 컨트롤러가 `layout: false` 로 렌더 |
| `/xray/chart` | `xray/chart.ejs` | **차트 만들기** — 축·지표·필터를 골라 직접 조합. 스펙이 쿼리스트링에 담겨 **URL 이 곧 공유 링크** |

> ⚠️ **nav 라벨은 "차트", 페이지 h1 은 "숫자로 본 국회", 내부 식별자는 `xray`** — 셋이 다르다.
> 2026-08-10 구 "국회 X레이" → "숫자로 본 국회", 2026-08-11 nav 라벨만 "숫자" → **"차트"**
> (커스텀 차트 빌더가 붙으면서 메뉴 성격이 "지표 열람" 에서 "차트" 로 바뀌었다).
> URL `/xray`, `.xr-*` 클래스 223곳, 파일·디렉터리명은 **의도적으로 유지** — `.pb-*` 와 같은 판단.
| `/community` | `community/list.ejs` | 게시판 목록 (20개/페이지) |
| `/community/write` | `community/write.ejs` | 작성 (법안 검색 첨부) |
| `/community/:id/edit` | `community/write.ejs` | 수정 (mode=edit) |
| `/community/:id` | `community/detail.ejs` | 상세 (조회수·좋아요·댓글) |
| `/my` | `my/profile.ejs` | 마이페이지 (`requireLogin`) — 프로필(+로그아웃·회원 탈퇴) / 성향 카드 / 게임팩 / 분석 요청 요약. **2026-08-16 재구성**: 카드는 `balance/_result_axes.ejs` 파샬(invite·reveal 과 같은 마크업 — 구 \|값\| 다이아몬드·`mapping v1` 메타 삭제) + 행동 4개(공유·가까운 의원·비교·다시 풀기). 미완료면 `16 / 20` 진행바 + `이어서 풀기`. 게임팩 행은 **통째로 링크**(`/balance-game/respond?pack=`), 상태별 버튼 라벨(시작/이어서/다시). ⚠️ 응답 수는 **활성 문항 기준**(`listUserPackHistory` 조인) — 문항 교체 후 옛 응답을 세면 16/20 인데 완료로 보인다. **+ 내 활동** — 총계 카드 4장(댓글·찬반·별점·게시글)이 **탭**이고, 고른 종류의 목록을 10건씩 페이징 (`getActivityCounts.sql` · `getActivityPage.sql`, 첫 페이지 SSR + `GET /my/activity?kind&page` JSON, 행 마크업은 `_activity_row.ejs` 와 JS `row()` 가 같아야 한다). 기본 탭은 활동이 있는 첫 종류. 모르는 kind·범위 밖 page 는 기본값·마지막으로 접는다. 🔴 본인에게만 보이는 화면이다. 이 쿼리를 다른 사람의 활동 기록 표시에 재사용하지 말 것 (방문 통계가 사용자별 페이지 로그를 안 남기는 원칙과 같다). **+ 성별·연령대 인라인 변경**(`PUT /api/auth/profile`, 선택지는 `auth/setup.ejs` 와 동일 — 14세 미만 없음) |
| `/my/analysis-requests` | `my/analysis_requests.ejs` | 마이페이지 — 내가 요청한 AI 분석 (`requireLogin`) |
| `/balance-game` | `balance/invite.ejs` | 성향 진단 진입 — **2026-08-16 재구성**: 미완료는 "당신과 가장 가까운 국회의원은?" 히어로 + `이렇게 나옵니다` 3칸(좌표·의원 순위·공유 카드), 완료는 히어로가 곧 **내 결과**(4축 막대 + 한 줄 요약) + 행동 3개(**결과 이미지로 공유** · 가까운 의원 · 다른 사람과 비교). `게임팩`·`매핑` 용어는 첫 화면에서 뺐다. 주제팩 "준비 중" 빈 상자 → 한 줄 |
| `/balance-game/respond` | `balance/respond.ejs` | 단계 2 응답 (한 화면 한 문항, 즉시 서버 저장, 이어하기, 키보드 1·2·3·←) |
| `/balance-game/reveal` | `balance/reveal.ejs` | **「당신의 카드」** (2026-08-16 재작성) — 카드 = `_result_axes.ejs` 파샬(헤드라인 + 4축 막대·해석, 진입 페이지 완료 히어로와 **같은 마크업**) + 가까운 의원 3명 + [결과 이미지로 공유]·[의원과 비교]. 연출은 약 2.5초, **`localStorage` + `computed_at` 키라 결과가 바뀔 때만** 다시 연출 (구 13초 · sessionStorage 게이트 · \|값\| 다이아몬드 · 응답 분포는 제거). JS 없이도 카드가 보인다 |
| `/balance-game/compare` | `balance/compare.ejs` | **「의원과 비교」** (2026-08-16 전면 재작성) — ① 축별 위치: 내 점 vs 의원 전체 평균 마커 + `의원 292명 중 N명이 나보다 ○○ 쪽` ② 좌표가 가장 가까운/먼 3명 (3축 미니 막대에 나·의원 두 점, 순위만) ③ 응답자 평균은 50명 모이면 같은 막대에 마커로 (실측 6명이라 잠금 상태를 숫자로 보인다). 아래 항목 참조 |
| `/balance-game/connect` | — | **폐지 (2026-08-16)** → `/balance-game/reveal` 로 301. 카드가 가까운 의원·공유·비교를 다 갖게 되어 역할이 겹쳤다. `카드 갤러리 준비 중` 타일 같은 죽은 약속도 같이 사라짐. **카드 컬렉션 구상은 주제팩이 실제로 생기면 그때** (`balance_game_packs` 모델은 그대로) |
| `/balance-game/types` | `balance/types.ejs` | **성향 유형 9종 안내** (2026-08-16, 공개) — 유형 지도(사분면 4 + 원점 거리 링 0.20/0.55) · 9종 카드(부제·설명·조건) · 판정 기준. 로그인·완료면 내 유형 강조 + 지도에 내 점. 데이터는 `utils/axisConfig.js TYPE_LIST/typeOf` 하나 |
| `/balance-game/share` | `balance/share.ejs` | **결과 공유 이미지** (2026-08-16) — 스토리 1080×1920 · 피드 1080×1350 를 **클라이언트 canvas** 로 그려 저장·`navigator.share`. 아래 "성향 진단 결과 공유 이미지" 참조 |
| `/balance-game/mapping` | `balance/mapping_preview.ejs` | 매핑 미리 보기 (DB 조회, 게임팩별 섹션) |
| `/auth/welcome` | `auth/welcome.ejs` | 가입 직후 환영 페이지 (1회 노출, [지금 풀기]/[둘러보기]) |
| `/admin/titles` | `admin/titles.ejs` | **관리자 — 의원 직위 관리** (`requireAdmin`). 수동 직위 CRUD + 재확인 상태 |
| `/admin/stats` | `admin/stats.ejs` | **관리자 — 방문 통계** (`requireAdmin`). `?days=7|30|90`. 아래 "방문 통계" 참조 |
| `/admin/schedule` | `admin/schedule.ejs` | **관리자 — 운영 일정** (2026-08-16). 정기·조건부 작업이 언제 했고 언제 해야 하는지: 축 매핑 분기 갱신(마지막 `bill_axis_mapping` v2 `updated_at` + 91일 · 명령 3줄 · 확인 항목) · 의원 좌표 재계산(`computed_at`) · 유형 분포 점검(완료자 50명 트리거) · 직위 재확인(`review_after`) · 브리핑(마지막 카드 날짜) + **일일 배치 체인 표**(`batch_runs` 별 마지막 성공/실패·오류, 실패·2일 이상 정체는 빨강, 상단 경고). 🔴 **일정 테이블을 만들지 않았다** — 각 작업이 스스로 남기는 기록에서 읽고 주기는 `AdminController.getSchedulePage` 의 행 정의에 적는다. 정기 작업을 추가하면 거기 행 하나. ⚠️ `calcPoliticianAxis`·`calcGroupAxisAvg` 는 `batch_runs` 를 안 남겨 표에서 `기록 안 남김` — 좌표는 ② 행으로 본다. 쿼리 `getScheduleSignals.sql`·`getScheduleBatches.sql` |
| `/about` | `about.ejs` | 사이트 소개 |

### 🔴 불참 처리는 **바꾸지 못한다** — 5가지 안 전부 실측 실패 (2026-08-16)
"불참 처리부터 고쳐달라" 는 요청으로 대안을 전부 구현·측정했다. **어느 것도 쓸 수 없다.**

| 방식 | 불참vs제도 | 불참vs경제 | 왜 못 쓰나 |
|---|---|---|---|
| **현행** (불참을 분모에서 제외) | −0.529 | −0.474 | 보이콧 정보를 통째로 잃는다 |
| 불참 = 중립 0 (분모 포함) | −0.570 | **−0.722** | **더 나빠진다.** "많이 빠진 사람 = 중도" 라는 새 왜곡 |
| 최소 참여 60% + 축소(k=2) | **−0.390** | −0.498 | 🔴 **국민의힘 62.3% vs 민주당 1.9% 탈락** — 정치적으로 편향된 제외 |
| 보이콧 법안(7건) 매핑 제외 | −0.506 | −0.427 | 효과가 거의 없다 |
| 법안별 센터링(공통성분 제거) | −0.565 | −0.261 | 제도축이 오히려 악화 |

**🔴 근본 원인 — 22대 본회의의 가장 큰 대립은 반대표가 아니라 `불참` 으로 나타났다.**
특검법류에서 **국민의힘 106명이 찬성 0 · 반대 0 으로 전원 불참**했다 (조직적 표결 보이콧).
- 불참을 **버리면** 그 대립을 통째로 못 본다 (현행)
- 불참을 **반영하면** 한 정당 전체가 한 방향으로 밀린다
- 참여가 적은 사람을 **빼면** 보이콧한 정당이 통째로 빠진다
→ **중립적인 처리가 존재하지 않는다.** 편향 없는 유일한 선택이 현행이라 그대로 뒀다.

**대신 화면이 한계를 말한다** (`_profile_vs.ejs` 의 `.pv-basis`):
`찬성·반대만 세고 불참은 빼기 때문에, 표결에 참여하지 않는 방식으로 드러낸 입장은 담기지 않습니다.`
🔴 이 문장을 지우지 말 것 — 이게 없으면 좌표가 "모든 입장을 반영한 값" 으로 읽힌다.

**다음에 손댈 지점은 불참 처리가 아니라 소스다.** 표결은 반대가 0.66%뿐이라 성향을 못 담는다.
공동발의는 만장일치가 아니라 **선택**이므로 그쪽을 봐야 한다 (다만 건수로는 안 갈린다 — 위 항목 참조).
→ **그래서 공동발의로 시험했고, 매핑 없이는 안 된다는 결론이 났다.** 바로 아래 항목.

### 🔴 공동발의 행렬로 좌표를 뽑는 것도 **안 된다** — 데이터 주도 축은 정당·지역·위원회 네트워크다 (2026-08-16 실측)
"표결 대신 공동발의(`bill_co_proposers`)로 4축 좌표를 만들 수 있나" 를 두 갈래로 시험했다. **둘 다 실패.**

**(a) 기존 매핑 48건 × 공동발의 여부** — 재료가 없다.
48건에 붙은 공동발의 행이 **전부 합쳐 642행**(법안당 평균 13명, 의원 309명 중 대부분 0건). 표결은 법안당 300명이 찍지만
공동발의는 10~15명만 이름을 올리므로 **같은 매핑을 재사용할 수 없다.** 열지 말 것.

**(b) 매핑 없이 대응분석(CA)** — 재료는 충분하다 (현직 235,666행 · 법안 18,754 · 의원당 중앙값 703건 · 밀도 4%).
축은 잘 나오는데 **그 축이 성향이 아니다:**

| 축 | 설명비율 | 정당 η² | 정체 |
|---|---|---|---|
| 1 | 4.2% | **97.5%** | 민주(−0.68) ↔ 국힘(+1.42). 국힘 당내 sd **0.026** |
| 2 | 2.5% | **95.0%** | 조국혁신당(+3.47) 분리 |
| 3 | 1.2% | 61.3% | 진보당(−3.82) 분리 |
| 4 | 1.0% | 5.0% | 민주 **당내** 변이 — 극단 법안이 농해수위 vs 법사·문체위 |

정당 안으로 들어가 따로 돌려도(민주 169명·국힘 111명) 상위 3축은 **전부 지역·위원회 네트워크**다:

| | 설명비율 | 지역(시도) η² | 첫 상임위 η² | 정체 |
|---|---|---|---|---|
| 민주 축1 | 1.8% | 27.4% | 23.8% | 경기·인천(+) ↔ 전남·비례(−) |
| 민주 축2 | 1.7% | **48.3%** | 28.0% | 전북 1.09 · 제주 0.98 · 전남 0.34 ↔ 수도권 −0.2~−0.4 (호남 vs 수도권) |
| 국힘 축1 | 2.3% | **52.1%** | 19.3% | 부산 −0.68 ↔ 경북 0.31 · 대구 0.27 (PK vs TK) |
| 국힘 축2 | 2.2% | 14.9% | 23.2% | 위원회 |

- 어느 축도 **당론이탈·교차표결 격차·불참률·기존 4축과 |r| ≤ 0.3** — 성향으로 알려진 어떤 값과도 안 겹친다
- 축별 설명비율이 **1.5~2.5%** — 지배적인 축 자체가 없다. 공동발의는 이념 스펙트럼이 아니라 **"누구에게 서명을 부탁하나"**
  (같은 당 → 같은 지역 → 같은 위원회) 라는 사회연결망이다
- 정당색 관점의 함정: 축 1 은 정당을 완벽히 가르므로 "성향축" 처럼 보인다. **그건 정당 소속을 다시 그린 것**이라
  "당 말고 사람" 취지와 정반대다 (검증 기준 ①에서 탈락)

**그래서 근본 결론 — 좌표는 소스가 아니라 라벨(매핑)의 문제다.**
표결이든 공동발의든 **법안이 어느 방향인지 모르면 성향이 안 나온다.** 데이터 주도 축은 방향 없이도 뽑히지만
그건 네트워크 구조를 재현할 뿐이다. 남은 길은 하나 — **`bill_axis_mapping` 을 수천 건 규모로 늘리는 것**(AI 1차 매핑 +
검토)이고, 그때 소스는 표결이 아니라 **공동발의(=서명한 법안의 방향 가중평균)** 가 맞다. 단:
- ⚠️ 공동발의는 **부호가 항상 "찬성"** 이다 (반대하는 법안엔 이름을 안 올린다). 좌표 변이는 **오직 매핑의 방향 배분**에서만
  나오므로 지금처럼 `+1 : −1 = 13 : 2` 로 치우치면 전원이 +1 로 다시 뭉친다. **매핑을 늘릴 땐 축마다 방향 균형을 먼저 맞출 것**
- ⚠️ 의원당 서명 법안이 중앙값 703건이라 매핑이 3,000건이면 의원당 약 110건이 잡힌다 — 표본은 충분해진다
- 시험 스크립트는 남기지 않았다. 재현: CA 는 `M_ik = Σ_j x_ij x_kj/(n² c_j) − r_i r_k` 를 `√(r_i r_k)` 로 나눈 309×309
  행렬의 상위 고유벡터, 행 좌표 `u_i/√r_i · √λ`. 정당·지역·위원회 η² 와 당론이탈·격차·불참률 상관을 같이 낼 것

### 「의원과 비교」 `/balance-game/compare` (2026-08-16 전면 재작성)
🔴 **구 버전은 사실상 죽은 페이지였다.** 응답자 평균(전체·성별×연령대 그룹)을 다이아몬드로 겹치는 화면인데 임계값이 50명이고
실측 완료자가 **6명**이라 토글이 전부 잠겨 빈 다이아몬드 + "데이터가 충분하지 않습니다" 만 떴다. 정작 데이터가 있는 **의원**(좌표 292명)
비교는 `비슷한 의원 (준비 중)` 으로 남아 있었다 — 4월 설계 문구 그대로. 뒤집었다: **주인공은 의원 비교, 응답자 평균은 열릴 때까지 잠금 상태를 숫자로.**

```
daos/queries/politician/getMatchSpread.sql   ← 가장 가까운/먼 N명 + 좌표 있는 의원 수 · 의원 축 평균 · 축별 "나보다 오른쪽인 의원 수" (윈도 집계, 한 쿼리)
PoliticianDao.getMatchSpread → PoliticianService.getMatchSpread  { total, avg, right, near[], far[] } · 실패 시 null
```
- ① **축별 위치** — 3축 양극 막대(의원 상세 `.pv-band` 문법): 내 점(골드) + **의원 평균 마커**(진한 세로선+삼각캡, 사이트 공통 평균 마커) +
  `의원 292명 중 157명이 나보다 더 정부 개입 쪽, 135명이 시장 자율 쪽`. 안보축은 내 점만 그리고 `의원 좌표 없음` + `UNMEASURED_REASON`
- ② **가장 가까운 3명 / 가장 먼 3명** — 카드마다 3축 미니 막대에 나(골드)·의원(점선 무채색) 두 점 + 사이 띠. 라벨은 `292명 중 1위 / 292위` (순위만, % 없음).
  가장 먼 쪽을 넣은 이유: "나와 정반대인 사람" 이 가까운 사람만큼 알려준다 (`match-asc` 정렬을 둔 것과 같은 판단)
- ②-b **전체 분포 속 나** (2026-08-16 추가) — 경제×사회 평면 인라인 SVG: 좌표 있는 의원 전원(익명 점, `getAxisCloud`) + 나 + ①②③/ⒶⒷⒸ 배지 + 나→가까운 점선.
  공유 카드가 막대형 기본이 되면서 "분포는 결과 페이지에서" 로 역할을 나눴다 (막대형 피드백). 색은 입히지 않는다 — 두 덩어리가 곧 정당이라
- ③ **응답자 평균** — `overall.user_count ≥ 50` 이면 ①의 막대에 회색 마커(`.cp-avg.is-resp`)로 붙고 범례에 추가된다. 미달이면 잠금 문구에 **현재 인원**을 쓴다
  (`지금 6명`) — 빈 상태가 고장으로 안 읽히게. 그룹 평균은 그룹당 50명부터 (임계값은 구 버전 승계)
- 🔴 **다이아몬드로 되돌리지 말 것** — |값| 만 그려서 시장 −0.5 와 개입 +0.5 가 같은 모양이었다 (의원 상세에서 버린 이유와 같다).
  평균과 겹쳐도 "방향이 같은지" 를 못 읽는다
- **reveal 도 같은 날 같은 방향으로** — 카드 본문을 `views/balance/_result_axes.ejs` 파샬로 빼서 invite 완료 히어로와 reveal 카드가 한 마크업을 쓴다.
  구 reveal 은 13초 연출(sessionStorage 게이트라 새 탭마다 반복) + \|값\| 다이아몬드였고 정보가 진입 페이지보다 적었다 (사용자 지적).
  진입 페이지의 `카드 다시 보기` 링크는 뺐다 — 히어로가 곧 카드다
- 5단계 문법(`📊 단계 4 — 비교` · `여기까지 봤어요 80%` · Bebas 제목) 제거 — 진입 페이지·`/my` 에서 바로 들어오면 "단계 4" 가 무슨 말인지 모른다.
  진입: `/balance-game` 완료 히어로 `[의원과 비교]` · reveal `[의원과 비교]` · `/my`. 출구: `[결과 이미지로 공유]`(primary) · 가까운 순 의원 목록 · `← 내 카드`(reveal)
- 🔴 **성향 진단 흐름은 이제 넷이다** — `진입(/balance-game) → 문항(respond) → 카드(reveal, 마지막 화면) → 공유(share) / 의원과 비교(compare)`.
  단계 번호(`단계 N`)·`여기까지 N%` 진행바는 전부 뺐다. 5단계 문법을 되살리지 말 것 — 진입 페이지·`/my`·홈에서 중간 화면으로 바로 들어온다
- 실측: 쿼리 292행 윈도 집계 수 ms · 잠금/열림/spread null 3상태 렌더 확인

### 성향 진단 결과 공유 이미지 `/balance-game/share` (2026-08-16)
"사용자가 광고주가 되는" 유일한 구조 — 진단 완료자가 자기 좌표 카드를 인스타 스토리·피드에 올리고, 카드의
`dangmalsa.kr/balance-game` 로 다음 사람이 들어온다. 진입: 단계 5 `연결`(출구 타일 `결과 이미지`) · 단계 3 `펼침` 하단 링크 · `/my` 성향 카드.

```
controllers/BalanceGameController.js  getSharePage  ← 재료만 JSON (좌표 4축 · 가까운 의원 3명 · AXIS_META · 날짜)
views/balance/share.ejs               미리보기 canvas + 크기 토글 + [공유하기]/[이미지 저장]
public/scripts/balance/shareCard.js   🔴 그림은 전부 여기 — canvas 2D 로 직접 그린다
```

- 🔴 **canvas 로 그리는 이유** — 의존성 0 이고 **미리보기와 산출물이 같은 canvas** 라 "미리보기는 멀쩡한데 저장한 게 깨지는" 일이 없다.
  html2canvas 류는 웹폰트·`keep-all` 재현이 불완전하고, SVG→canvas 는 SVG 안에서 문서 웹폰트를 못 써 폴백으로 찍힌다.
  canvas `fillText` 는 문서가 받은 웹폰트를 그대로 쓴다 — `document.fonts.load(spec, 그릴 글자 전부)` 로 **한글 서브셋을 미리 당긴 뒤** 다시 그린다
  (Google Fonts 는 unicode-range 서브셋이라 텍스트를 안 넘기면 필요한 조각이 안 온다). 폰트 전 1차 렌더 → 폰트 후 재렌더
- 🔴 **외부 이미지를 canvas 에 그리지 말 것** — 의원 사진(assembly.go.kr)을 그리는 순간 canvas 가 taint 돼 `toBlob` 이 막힌다.
  그래서 의원은 **이름·지역구만**, 브랜드 마크도 SVG 파일이 아니라 `mark-only.svg` 좌표를 path 로 다시 그린다
- 의원은 **좌표가 가장 가까운 3명 | 가장 먼 3명(반대 성향)** 두 열 (`getMatchSpread`, compare 와 같은 쿼리). 가까운 쪽만 있으면 "내 편 목록" 으로 읽힌다 — 반대쪽을 나란히 두면 좌표라는 게 드러난다 (사용자 제안). 먼 쪽 순위는 `292·291·290`
- 🔴 **정당명·정당색 없음 · % 일치도 없음** — 인스타 카드·홈 「나와 맞는 의원」과 같은 규칙. 순위와 지역구까지만.
  정당을 뺀 건 **의도**다 (사용자 확인 2026-08-16): 카드가 혼자 돌아다닐 때 정당명이 붙으면 "가까운 = ○○당 / 반대 = △△당" 대비 구도로 읽히고, "당 말고 사람" 이 무너진다. 지역구로 누구인지는 알 수 있고 정당은 사이트에서 보인다
  `퇴임` 은 무채색 텍스트. 안보축은 사용자 좌표는 그리되(본인 성향) 의원 비교 각주에서 제외 사유를 쓴다
- 🔴 **개인정보 없음** — 닉네임·성별·연령대를 싣지 않는다 (`connect` 의 "내 결과는 비공개" 약속과 정합). 카드는 사용자가 **스스로** 내보내는 것
- 🔴 **숨기지 말 것** — 처음엔 5단계 끝(`연결`) 출구 타일 하나뿐이라 사용자가 "너무 숨어 있다" 고 했다. 지금 진입로 5곳:
  `/balance-game` 완료 히어로의 **첫 버튼** · 홈 「나와 맞는 의원」 헤더 링크 · 카드(reveal)·비교(compare)의 첫 버튼 · `/my` 성향 카드.
  공유가 유일한 사용자 발 유입 경로라 진입로를 줄이면 안 된다
- 🔴 **v2 는 포스터다 (2026-08-16 같은 날 재설계).** v1 은 사이트 페이지를 축소한 "자료 카드"(긴 양끝 라벨·해석 문장·각주 3줄)였는데
  폰에서 스토리는 ~2.8배 축소되어 20~24px 글자가 8px 이 된다 — "빽빽하고 구식" 만 남았다 (사용자 지적: 젊은 사람이 튕겨 나간다).
  v2: 헤드라인 **92px 세리프 900** 이 주인공 · 축은 **짧은 극 라벨(시장|개입)** 만, 굵은 트랙(16px)+큰 점(r17), 내가 있는 쪽 라벨만 진하게 ·
  해석 문장·주제 설명·각주 삭제(한 줄만) · 이름은 크게(34px) 지역구는 작게 · **밝은 판 / 어두운 판** 토글(`THEMES`, `?theme=dark`).
  어두운 판은 피드에서 눈에 띄라고 둔 것 — 골드가 밝은 판보다 한 톤 밝다(`#D9A040`). 정당색은 여전히 없다.
  🔴 **어두운 판의 면(지도 판·내 사분면·CTA 상자)은 무채색 반투명 흰색** — 골드를 다크 위에 얹으면 탁한 갈색이 된다. 골드는 선·점·글자에만.
  ⒶⒷⒸ 회색 배지도 어두운 판에선 `#8B93A1` 로 한 단계 밝게 (`#4A505B` 는 배경에 묻혔다). 밝은 판은 지우지 않는다 — 카톡 링크 프리뷰는 흰 말풍선 위라 밝은 판이 자연스럽다
  ⚠️ 각주를 다시 늘리고 싶어지면 이 이유를 먼저 볼 것 — 카드는 훅이고 각주는 사이트에 있다
- 🔴 **유형 9종 체계 (2026-08-16 2차 제안 채택)** — 판정은 **원점 거리 `d = √(x²+y²)`**: `d<0.20` 균형 조율자 / `0.20≤d<0.55` 온건한 ○○ / `d≥0.55` ○○.
  🔴 **안전장치: 한 축이라도 |v|<0.25 면 d 와 무관하게 온건** — 이름은 부호로 정해지므로 경제 +0.05·사회 +0.9 를 `포용 개혁가(개입·자율)` 라 부르면 "개입" 이 거짓.
  제안서 `resolveType` 엔 없는 규칙이라 넣었다. 9종 각각 **부제(sub, 카드 헤드라인 아래 한 줄)** 와 **결과 설명(desc)** 을 제안서 문안으로 채택 (`TYPE_NAMES[k].sub/desc/mildSub/mildDesc`, `TYPE_MID`).
  ⚠️ 임계값 0.20/0.55 는 "고르게 나뉜다" 는 가정값 — 응답이 쌓이면 분포를 보고 옮길 것 (한 유형에 40%+ 몰리면 공유 가치가 떨어진다). `/balance-game/types` 가 이 체계를 화면에 명시한다
- 🔴 **유형 이름이 헤드라인이다 — `utils/axisConfig.js` `TYPE_NAMES`/`typeOf()` 단일 소스** (2026-08-16, 외부 디자인 제안 채택).
  MBTI 가 퍼진 건 "INFP" 라는 이름표 때문 — 사람들은 좌표가 아니라 이름표를 공유한다. 경제(x)×사회·문화(y) 사분면 4종:
  `자유 개척자`(시장·자율) · `포용 개혁가`(개입·자율) · `자립 원칙가`(시장·전통) · `질서 설계자`(개입·전통) + 한 줄 설명.
  🔴 **네 이름은 똑같이 긍정적이어야 한다** — 이 사이트는 "이름 붙이지 않고 위치로 보여준다" 가 원칙이라, 이름표를 허용하는 조건은
  "한쪽만 멋있어 보이지 않을 것" 이다. 정당명·이념명(보수/진보) 금지, 4~5음절 명사형. 하나를 바꾸면 넷을 같이 볼 것
  - 🔴 **한 축이라도 중도(|v|<0.25)면 `온건한 ` 접두어, 둘 다 중도면 `균형 조율자`** — 이름은 부호로만 정하므로 이 규칙이 없으면
    경제 +0.2 인 사람이 `질서 설계자` 가 된다 (제안서 예시가 그랬다). 실측 사용자: `온건한 질서 설계자`. 나올 수 있는 이름은 4×2 + 1 = **9종**
    `온건한 ○○` 의 설명은 기본 설명 뒤에 `다만 {경제|사회·문화} 축은 가운데에 가까워 기울기가 강하지 않다.` 를 덧붙인다 (`typeOf().midAxis`) — 8종의 톤을 하나로
  - 카드(shareCard.js 는 `D.type` 을 받아 쓰기만)와 사이트 결과 화면(`_result_axes.ejs`)이 같은 이름·설명을 말한다.
    부제는 `유형 설명 한 문장 + "사회·문화는 전통, 정치제도는 안정에 가깝습니다"` (`쪽` 어미는 뺐다 — 단정적이지 않아 붙여넣고 싶은 문장이 안 된다)
- 🔴 **가까운 3명은 지도 위에 ①②③ 골드 배지, 가장 먼 3명은 ⒶⒷⒸ 회색 배지** — 아래 목록의 배지와 1:1 (외부 제안). 없으면 위 그림과 아래 목록이 따로 논다.
  ⚠️ 지도는 경제×사회 두 축이라 3축 거리로 고른 "가장 가까운" 이 평면에서 가장 가까워 보이지 않을 수 있다 (제도축 때문) — 정상이다
  - 배지끼리 겹치면 미리 정한 오프셋 후보 중 빈 자리로 비켜 놓고 **리더선**으로 점에 잇는다 (가장 먼 3명은 한 구석에 몰려 구조적으로 겹친다).
    나 → ①②③ 는 **옅은 골드 점선** — "가장 가까운 의원조차 이만큼 멀다" 가 정보가 된다. 둘 다 2차 피드백 반영.
    점선은 배지 자리를 **evenodd 클립으로 오려낸 뒤** 긋는다 (②→나 선이 ①을 관통했다, 3차 피드백) — 그래서 배지 위치를 먼저 정하고(plan) 선을 긋고 배지를 얹는 순서
  - 부제는 한 줄(`사회·문화는 전통, 정치제도는 안정에 가깝습니다`) — 유형 설명 문장과 같은 말이라 카드에선 뺐다. 헤드라인은 오른쪽 여백 48px 확보.
    지도 아래 한 줄엔 지도에 없는 축 중 **의원 비교에 쓰는 정치제도만** (안보는 차트에도 비교에도 없어 뺐다)
- **이미지에서 뺀 것**: 각주(`공동발의 기록 · 안보축 제외`). 축 설명 두 줄은 짧게 되살렸다 (제안서도 뒀고 사분면 이름만으로는 가로·세로가 안 온다는 지적이 먼저 있었다) — 0.5초에 스치는 이미지에서 읽는 사람이 없고 웹페이지(`/balance-game/share` 하단)에 있다.
  점은 작고 반투명(밀도로 보이게), 판 안쪽 여백 56px(±1 이어도 테두리에 안 붙게), 남는 세로 공간은 `extra` 로 제목·차트·목록 아래에 나눠 준다 (CTA 위만 비는 리듬 방지)
- 크기: UI 는 **스토리 9:16 · 피드 4:5** 둘만 (2026-08-16 정사각·가로형은 막아둠 — 코드는 `MODES` 에 남아 있다). 가로형 1200×628 (1.91:1, `drawLandscape` — 왼쪽 유형 이름·부제·브랜드 / 오른쪽 지도+주소)**.
  ⚠️ 가로형은 **사용자가 저장해 카톡으로 보내는 이미지**지, 링크를 붙였을 때 자동으로 뜨는 OG 이미지가 아니다 — 그러려면 사람마다 공개 URL(`/s/토큰`)과
  서버 생성 이미지가 있어야 하는데 결과가 비공개(세션)라 없다. 버튼 이름을 "링크 프리뷰" 에서 "가로형 · 카톡 전송용" 으로 바꾼 이유
- **막대형(`layout=bars`)에는 축마다 의원 마커** — 트랙 위 작은 삼각형(가까운 ①②③ 골드 / 먼 ⒶⒷⒸ 회색)+번호, 겹치면 라벨을 한 단 위로. 지도형이 못 하는 것:
  "경제는 나랑 같은데 사회·문화는 이만큼 다르다" 가 축별로 보인다 (막대형 피드백). 안보축은 의원 좌표가 없어 마커 없음(범례에 명시).
  핸들은 트랙 안쪽 34px 에서 클램프(±1 이어도 안 삐져나감), 중앙 기준선은 `sub2` 로 살짝 진하게(네 막대가 같은 x 라 세로 정렬로 읽힘).
  ⚠️ 스토리 상단 250px 빈 공간은 **인스타 UI 안전영역**이라 의도된 것 — "위가 비었다" 는 지적이 오면 이 이유를 먼저 볼 것
- 🔴 **막대형이 기본이다** (`layout=bars`, 2026-08-16 막대형 피드백으로 뒤집음 — 4축 + 축별 의원 마커가 지도형보다 정보가 많다).
  겹치는 마커(<28px)는 삼각형 하나에 `ABC`·`23` 처럼 **한 줄로 묶는다** (세로로 쌓으면 개별 식별이 안 된다). 라벨 21px·삼각형 20px — 피드 축소에도 살아남는 크기.
  지도형(`layout=map`)은 "의원 전체 분포 속 나" 를 보고 싶을 때의 대안으로 남긴다.
- **지도형** (`layout=map`, 같은 날 추가). 경제(x)×사회·문화(y) 평면에 **좌표 있는 의원 전원(292)을 익명 회색 점**으로 뿌리고
  나를 큰 골드 점 + `나` 라벨로 찍는다 (`getAxisCloud.sql` — 축 값만, 이름·정당 없음, 3KB). 지도에 없는 두 축(제도·안보)은 아래 한 줄.
  왜: v2 포스터도 결국 "글자+막대" 라 엄지를 멈출 **시각적 물체**가 없었다. 점구름은 익명이라 중립성에 걸릴 게 없고,
  "국회의원 전체 속에서 내가 어디" 라는 이 사이트의 핵심 문장이 그림 하나로 보인다. 막대형(`layout=bars`)은 4축을 다 보고 싶을 때
  - 🔴 **판이 무슨 뜻인지는 네 모서리의 사분면 이름이 말한다** (`시장 · 자율` / `개입 · 자율` / `시장 · 전통` / `개입 · 전통`),
    내가 있는 사분면은 옅게 칠하고 그 라벨만 진하게. 판 아래에 `가로 경제 ← 시장 자율 · 정부 개입 →` / `세로 사회·문화 ↓ 전통·질서 · 자율·다양성 ↑`
    두 줄. 처음엔 극 라벨(시장/개입)만 판 안에 띄웠는데 "가로·세로가 뭘 뜻하는지 확 안 온다" 는 지적을 받았다 — 사분면 이름이 정치 성향 지도의 읽는 법이다
  - ⚠️ 점구름이 두 덩어리로 갈리는 게 보인다 (정당). 색을 입히지 말 것 — 익명 회색이라 성립하는 그림이다
- 헤드라인은 |값| ≥ 0.25 인 축을 세기 순으로 2개, **짧은 극 라벨(L/R)** 로 (`정치제도는 개혁, 경제는 개입 쪽`).
  긴 형(Lx/Rx)은 축 줄 양끝에 다 나오므로 헤드라인까지 길게 쓰면 두 줄로 접힌다. 전부 중도면 `네 축 모두 중도에 가깝습니다`.
  축별 해석은 `compare.ejs` 의 `axisLine` 과 같은 4단계(중도/미세하게/약간 뚜렷하게/뚜렷하게)
- 크기: **story 1080×1920** (위 250 / 아래 240 을 비운다 — 인스타 UI·링크 스티커 자리, 브리핑 스토리 카드와 같은 판단) ·
  **feed 1080×1350**. CTA 박스는 여유가 160px 이하면 푸터 위에 붙이고, 많이 남으면(의원 조회 실패 폴백) 내용 뒤에 둔다 — 가운데 구멍보다 아래가 비는 쪽
- 🔴 **공유/저장은 재진입 차단(`busy`) + PNG 를 그릴 때 미리 만들어(`prepareBlob`) 클릭 순간 await 없이 시트를 연다** — 폰에서 시트가 열렸다 닫혔다
  반복한다는 보고(2026-08-16)가 있었다. 모바일은 사용자 제스처 안에서만 share 를 허용하고 await 뒤엔 권한이 사라질 수 있다.
  저장 링크엔 `data-no-loader` — 없으면 layout 의 페이지 전환 로더가 blob 링크 클릭을 내부 이동으로 오인해 덮는다
  🔴 **share payload 는 `{ files, text }` 다 — `files` 만 넘기지 말 것.** 삼성 인터넷 펼친 폴드(태블릿 모드)에서 files 만 넘기면 시트가 깜빡이며 재생성을 반복했고
  (2026-08-16 실기기 영상), `?debug=1` 실험 모드로 5가지 형태를 눌러본 결과 **files + text 만 정상**이었다. 카톡·인스타는 파일이 있으면 text 를 버리므로 화면 차이는 없다.
  삼성 인터넷에서 그래도 실패·취소하면 다음부턴 저장 폴백. `?debug=1` 실험 버튼(A~E)은 남겨뒀다 — 다른 기기에서 또 깨지면 그걸로 형태를 찾는다
- 🔴 **카카오톡은 시스템 시트로 보내면 이미지만 가고 링크가 안 실린다** (사용자 지적: 이미지 속 주소를 쳐서 들어올 사람은 없다).
  → **「카카오톡으로 보내기」 버튼**(`#sc-kakao`, `KAKAO_JS_KEY` 있을 때만): Kakao JS SDK `Share.uploadImage`(카카오 CDN, 우리 저장 없음) →
  `Share.sendDefault(feed)` 로 **이미지 카드 + `내 유형 알아보기` 버튼 한 메시지**. 제목은 `나는 {유형}`, 설명은 유형 부제.
  인스타 스토리는 여전히 링크 스티커 수동, X·쓰레드는 시스템 시트가 파일+텍스트를 같이 받는다
- 공유: `canvas.toBlob → File → navigator.canShare({files})` 면 시스템 시트(모바일 — 인스타·카톡이 여기 뜬다), 아니면 `<a download>`.
  iOS 에서 download 가 안 먹으면 새 탭에 dataURL 을 띄운다(길게 눌러 저장). 데스크톱은 공유 버튼을 숨긴다 — 저장이 곧 공유
  - **`클립보드에 복사`** 버튼(`ClipboardItem` PNG 하나)이 따로 있다 — macOS 공유 시트의 "복사하기" 는 파일 참조+이미지를 같이 넣어
    붙여넣는 앱에 따라 **2장으로 보인다** (실제 겪음). 그 경로 대신 이 버튼을 쓰라고 둔 것
  - 넘치면 `render()` 가 0.5단계씩 조여 다시 그린다 (간격 −28%/단계 · 글자 −3px/단계). 남는 공간은 60px 이하면 CTA 를 푸터에 붙이고,
    그보다 크면 CTA 위아래로 나눈다 — 처음엔 2단계로 한 번에 조였더니 헤드라인이 한 줄이 되며 가운데가 비었다
- 🔴 **스토리에 올릴 땐 링크 스티커를 사용자가 붙여야 한다** — 이미지에 박힌 URL 은 탭이 안 된다. 페이지 우측에 3단계 안내가 있다.
  스티커 색은 흰색으로 (인스타 기본은 파랑 — 정당색)
- `robots.txt` 에 `Disallow: /balance-game/share` (세션 의존 페이지 — 다른 balance 단계와 같은 처리)
- 실측 2026-08-16: 세 케이스(뚜렷/전부 중도/음수 극단+긴 지역구+퇴임) 스토리·피드 넘침 0. 하네스는 지웠다 —
  재현하려면 `window.__SHARE__` 에 `{axis, axes(AXIS_META 배열 + measured), matches, total, date, polMapping, siteHost}` 를 심고 스크립트를 로드하면 된다

### 매핑 확장 파일럿 — AI 1차 매핑 2,118건 → 균형 선별 244건 → 공동발의 좌표 (2026-08-16)
위 결론("병목은 라벨") 을 실측하려고 돌린 파일럿. **코드·데이터가 남아 있다:**

| | |
|---|---|
| 배치 | `batch/mapBillAxisPilot.js` — Haiku 로 법안을 축·방향·weight·confidence 로 분류, **(축×방향) 8셀 정원**이 찰 때까지 후보를 위원회별 층화 표집. `--select-only` 로 선별만 재실행 |
| 검증 | `batch/validateAxisPilot.js` — 좌표·정당 η²·탈락률·분할-반 신뢰도·당내 상관·확장 상한 추정 |
| 테이블 | **`bill_axis_mapping_pilot`** (2,118행 · `none` 포함 전건 · `is_selected` 244) — `bill_axis_mapping` 은 PK 가 `bill_id` 단독이라 v1 과 겹쳐 둘 수 없어 별도 |
| 비용 | 2,118건 **$2.36** (호출당 20건 · 캐시 적용). 크레딧 소진으로 3,000건 목표 중 2,118건에서 중단 |

- 🔴 **부호는 AI 의 숫자를 믿지 않고 축별 고정 라벨(`시장|개입`·`전통|자율`·`동맹|자주`·`안정|개혁`)에서 코드가 정한다.**
  dry-run 에서 "한미동맹 강화" 라고 써놓고 `+1`(자주)을 준 사례가 있었다. 라벨이 축과 안 맞으면 버린다
- 매핑률 61% (none 39%). 방향은 **구조적으로 치우친다** — 분류 2,118건 중:

  | 축 | −1 | +1 | 희소 방향 비율 |
  |---|---|---|---|
  | economy | 시장 124 | 개입 405 | 5.9% |
  | social | 전통 115 | 자율 209 | 5.4% |
  | **security** | 동맹 52 | **자주 20** | **0.9%** |
  | **institution** | **안정 26** | 개혁 328 | **1.2%** |

  → 선별 244건 = economy 76 · social 76 · **security 40 · institution 52** (희소 방향이 상한)

**공동발의 좌표 결과** (축당 서명 ≥3 인 의원만):

| 축 | 좌표 있음 | sd | 정당 η² | 민주 / 국힘 평균 | 민주·국힘 당내 sd | 분할-반 신뢰도 |
|---|---|---|---|---|---|---|
| economy | 172/309 | 0.57 | 44% | +0.35 / −0.36 | 0.45 / 0.40 | **0.51** |
| social | 160 | 0.46 | 26% | +0.26 / −0.22 | 0.41 / 0.41 | **0.17** |
| security | 73 | 0.75 | 75% | +0.49 / −0.84 | 0.49 / 0.28 | 0.81 (n=23) |
| institution | 136 | 0.47 | 24% | +0.41 / −0.13 | 0.38 / 0.52 | **0.32** |

- ✅ **방향은 맞고 축은 갈린다** — 네 축 모두 정당이 예상 방향으로 갈리면서 당내 sd 0.4~0.5 가 남는다 (v1 표결 기반은 안보축 84%가 같은 값)
- ✅ **출석·활동량 상관이 사라졌다** — 당내 |r(불참률)| ≤ 0.2 · |r(공동발의 총건수)| ≤ 0.2 (v1 은 −0.5). 표결 기반이 실패한 지점을 통과
- ❌ **그러나 표본이 너무 얇다** — 의원당 축별 서명 **중앙값 1~3건**. 값이 −1/−0.33/0.33/1 로 양자화되고
  분할-반 신뢰도가 economy 0.51 · social 0.17 · institution 0.32 → **지금 보이는 당내 변이의 대부분은 표본 잡음**이다.
  이 244건으로 좌표를 교체하면 안 된다
- ❌ **정당별 탈락률이 고르지 않다** (institution: 국힘 71% vs 민주 49% 미산출) — 커버리지 문제라 매핑이 늘면 풀린다

**전 코퍼스 실행 결과 (2026-08-16 같은 날, 총 18,590건 분류 · 누적 $20.6 · 균형 선별 4,972건)** — 판정 기준은 분할-반 신뢰도 0.8:

| 축 | 균형 매핑 | 좌표 있음 (서명≥5) | 서명 중앙값 | **분할-반 신뢰도** | 정당 η² | 민주 / 국힘 평균 (당내 sd) | 판정 |
|---|---|---|---|---|---|---|---|
| economy | 2,104 | 297/309 | 76 | **0.88** | 77% | +0.40 (0.19) / −0.27 (0.16) | ✅ |
| social | 1,962 | 295 | 68 | **0.76** | 53% | +0.20 (0.18) / −0.19 (0.21) | △ 기준선 근접 |
| institution | 788 | 294 | 30 | **0.71** | 73% | +0.33 (0.20) / −0.28 (0.17) | △ (`안정` 셀 사람 검토 전제) |
| **security** | 118 | **137** | 4 | 0.52 | 38% | — | ❌ **입법으로 못 잰다** (`자주` 코퍼스 전체 59건) |

- 당내 변이가 **진짜다** — 최빈값 비중 3%, 민주 사분위 0.18→0.64 · 국힘 −0.46→−0.09 로 당 안에서 순위가 선다
- 당내 |r(불참률·활동량)| ≤ 0.1 (제도축만 ±0.25). 전체 r(불참률) −0.5 는 국힘 불참률이 높아 정당을 경유한 값
- 정당별 탈락률 2~7% 로 고르다 — 표결 기반의 편향 제외 문제 없음
- 극단이 상식과 맞다: 경제 개입 끝 진보당·용혜인·이용우 / 시장 끝 박수민·박대출·박수영 / 제도 개혁 끝 윤호중·정청래·오기형
- v1(표결) 같은 축과의 상관: economy 0.61 · institution 0.81 · social −0.22 — 사회축은 **다른 것을 재고 있었다**
- → 사람 검토(축당 표본 50건 + `institution 안정` 394건 전건, `BILL_AXIS_MAPPING_v2_REVIEW.md`) 에서 지적 0건 → **v2 로 채택** (아래)

### 🔴 의원 성향 좌표 v2 — 공동발의 × 방향 매핑 4,854건 · **3축** (2026-08-16 전환 완료)
| | v1 (구) | **v2 (현재)** |
|---|---|---|
| 소스 | 본회의 표결 (찬성/반대) | **공동발의** (`bill_co_proposers` — 이름을 올렸는가) |
| 매핑 | 48건 (사람 1차) | **4,854건** (AI 1차 · 방향 균형 강제 · 표본 사람 검토) |
| 축 | 4축 | **경제·사회·정치제도 3축 — 안보 없음** |
| 축값 없음 | 0 으로 채움 | **NULL** (축당 서명 5건 미만 / 안보 전원) |
| 좌표 있음 | 294명 | 경제 298 · 사회 273 · 제도 287 / 세 축 다 있음 **269명** (2026-08-16 재분류 후. 재분류 전 297·295·294/292) |

- 🔴 **버전은 두 갈래다.** 사용자 좌표(문항 → `user_axis_score`)는 `'v1'` **그대로**, 의원 좌표(`bill_axis_mapping`·`politician_axis_score`)만 `'v2'`.
  같은 문자열을 쓰다가 갈랐다. 사용자 쪽까지 올리면 기존 진단 결과가 통째로 안 보인다.
  **단일 소스 `utils/axisConfig.js`** — `POL_MAPPING_VERSION`·`MATCH_AXES`·`UNMEASURED_REASON`·`MIN_SIGNATURES`
- 🔴 **거리·일치도 식은 `utils/balanceDistance.js` 하나다** (`app.locals.axisDistance/similarityPct/politicianAxisOf`).
  뷰(`politician.ejs`·`_profile_vs.ejs`)는 이걸 부른다 — 축을 손으로 나열하지 말 것.
  SQL 쪽 셋(`getMatchContext`·`getTopMatches`·`balanceGame` 미들웨어)은 같은 3축 식을 각자 갖는다 — 축을 바꾸면 넷을 같이
- 🔴 **안보축은 0 이 아니라 NULL 이고, 화면은 이유를 숫자로 쓴다.** 0 으로 두면 "둘 다 중도" 로 읽혀 거짓이 된다.
  `_profile_vs.ejs` 의 안보 행을 **지우지 않고** `분류 18,590건 중 자주 59건 · 동맹 253건` 을 쓴다 (`axisConfig.UNMEASURED_STATS`,
  재분류하면 같이 갱신). 빈 자리는 고장으로 읽힌다
- 🔴 **화면 구조 (2026-08-16 2차)** — 우측 320px 패널은 **순위만**, 축별 비교는 히어로 아래 **전체폭 띠 `.pv-band`** 에 축마다
  **양극 막대 한 줄** (왼끝 L ↔ 오른끝 R · 내 점 골드 · 의원 점 무채색 점선 · 두 점 사이 띠 = 그 축의 거리) + 매핑 법안 수 + 해석 + 서명 수.
  ⚠️ 다이아몬드/삼각 레이더로 되돌리지 말 것 — `|값|` 만 그려서 시장 −0.5 와 개입 +0.5 가 같은 모양이었고("도형 크기가 뭘 뜻하나"),
  세로 패널이 650px 이 되어 왼쪽(사진·정보 240px) 아래가 통째로 죽은 공간이었다. 실측: 히어로 650 → 591px, 모바일 375px 가로 오버플로 0
  - 🔴 **패널과 띠는 한 카드(ㄱ자)다.** 패널을 행 바닥에 붙이고(`align-self: end`) 그리드 row-gap 을 음수 마진(`--pv-join`)으로
    상쇄해 띠에 잇는다 — 아래 모서리·테두리를 열고 **1px 더 겹쳐** 띠의 위 테두리를 덮는다 (안 덮으면 패널 밑에 가로줄이 남아 두 카드로 보인다).
    ⚠️ `--pv-join` 은 `.profile-identity` 의 gap 과 같아야 한다 (데스크톱 32 · ≤768 20). gap 을 바꾸면 같이
  - 🔴 **양끝 라벨은 긴 형** (`시장 자율 ↔ 정부 개입` · `전통·질서 ↔ 자율·다양성` · `현 제도 유지 ↔ 제도 개혁`) + 축 이름 아래
    **한 줄 설명**(`AXIS_META.desc`). `시장`·`안정`·`전통` 만 두면 무엇의 어느 쪽인지 안 읽힌다 (사용자 지적). 짧은 형(L/R)은 폭이 없는
    홈 카드·범례에서만 쓰고 title 로 긴 형을 붙인다. `BalanceGameService.AXES`(문항 화면 라벨)도 `AXIS_META` 에서 파생 — 진단 화면과 의원 화면이 같은 말
  - 🔴 **범례는 띠 머리(`.pv-band-head`)의 제목 바로 오른쪽에** — `● 나 · ○ 의원 이름 · ▬ 두 점 사이 = 거리`. 양끝으로 갈라두면 제목과 무관해 보인다 (사용자 지적)
  - 한 카드로 읽히게 패널·띠 모두 `border2` 테두리 + **골드 3px 윗선**, 그림자 없음 — 두 윗선이 ㄱ자 외곽선을 이룬다
- 🔴 **분모 1.5 는 그대로 뒀다.** 축이 3개라 최대 거리가 1.73 으로 줄었지만 화면 주인공은 순위고 % 는 "근사" 보조라 재보정 안 함
- `bill_axis_mapping` PK 가 `(bill_id, mapping_version)` 으로 바뀌었다 (`ddl/migrations/2026-08-16-bill-axis-mapping-v2.sql`).
  v1 48건은 남아 있다 (`--version v1` 로 옛 좌표 재산출 가능)
- `calcPoliticianAxis.js` 는 `--version v2` 가 기본이고 소스가 자동으로 `coproposers` 다. 축별 서명 수(`economy_n` 등)를 같이 저장 —
  상세 축 목록에 `서명 N건` 으로 표본 크기를 보인다. 산출에 없는 낡은 행은 삭제한다
- ⚠️ `/xray` 스펙트럼은 안보 칩을 뺐고, 축 값 NULL 인 의원은 **그 축 계산에서만** 뺀다 (`Number(null)=0` 함정 — `nn()` 로 null 유지)
- **정기 갱신은 분기 1회 · 로컬 · 명령 하나** — `node batch/mapBillAxisPilot.js --target 100000 --max-candidates 20000 --sync-v2`
  (미분류 법안만 분류 ≈ 한 달치 $0.8 → 결정적 재선별 → `--sync-v2` 가 v2 에 미러링: 신규 UPSERT · 빠진 `ai_v2` 행 삭제).
  좌표는 다음날 크론 `calcPoliticianAxis` 가 재계산한다. 🔴 **크론에 넣지 말 것** — 비용 + 희소 셀(안정·동맹) 사람 검토 단계가 있다.
  매핑 없이 두면 커버리지가 매달 약 4%p 씩 빠진다 (월 ~700건 발의)
- 🔴 선별은 **결정적**이다 (`confidence → weight → 이미 선별됨 → bill_id`). random() 이면 재선별마다 법안이 갈려 좌표가 이유 없이 흔들린다.
  새 법안은 기존 선별을 밀어내지 않고 정원 미달 셀만 채운다. **방향 균형(셀별 정원)이 전제**다 — 공동발의는 부호가 항상 찬성이라 균형이 깨지면 전원이 한쪽으로 뭉친다
- ⚠️ 동명 법안(예: `한미 전략적 투자 관리 특별법안` 4건)은 weight 를 나누지 **않았다** — `조세특례제한법 일부개정법률안` 처럼
  이름은 같아도 내용·방향이 다른 계열이 많아 이름으로 묶으면 오히려 틀린다
- ✅ 검증 실측 (2026-08-16 재분류 전): 분할-반 신뢰도 경제 0.88 · 사회 0.76 · 제도 0.71 / 당내 |r(불참·활동량)| ≤ 0.1 (제도 ±0.25) /
  → **재분류 후(같은 날 저녁, 아래 「눈금 보정 실측」)**: 경제 0.88 · **사회 0.63 · 제도 0.60** — 축이 재는 것을 문항에 맞추면서 법안이 줄어 신뢰도가 내려갔다. 의도된 교환이다 /
  정당별 탈락률 2~7% / 홈 TOP3·상세 순위·`is-missing` 분기 렌더 확인. **`.is-near`/`.is-weak` 클래스가 `<%=` 이스케이프 때문에
  원래부터 안 먹고 있던 것**도 이때 잡았다 (`<%-` 로 수정)
- 🔴 **희소 방향은 라벨 품질이 나쁘다 — 자동으로 채운 채 쓰면 안 된다.** 진짜 사례가 드무니 AI 가 억지로 채운다:
  `institution 안정` 26건의 절반이 "질서·처벌 강화"(과태료·형사벌) 로 사실상 사회축이고,
  `security 동맹` 에는 "방위산업기술 보호"·"국방반도체" 같은 **누구나 찬성하는 국방력 일반**이 섞였으며
  "대북전단 규제·남북합의서 강화" 를 동맹(−1)으로 붙인 **명백한 오류**도 있다. `security 자주` 20건은 남북교류·평화 법안으로 일관됐다
  → 전 코퍼스로 갈 땐 **희소 두 셀(안정·동맹)은 사람이 전건 검토**하는 것을 전제로 할 것. 나머지는 표본 검토로 충분
- ⚠️ 동명 법안이 셀을 채운다 (`한미 전략적 투자 관리 특별법안` 4건 전부 security −1). 같은 이름은 사실상 같은 법안이라
  좌표에는 한 건처럼 작용해야 맞다 — 확장 시 `bill_name` 으로 묶어 weight 를 나눌 것
- ⚠️ 표결 기반(v1)과의 상관은 economy 0.39 · institution 0.48 · social −0.04 · security −0.27 — 같은 이름의 축이 **다른 것을 재고 있다.**
  교체하면 사용자 문항(`balance_game_questions`)과의 정합도 다시 봐야 한다 (검증 기준 ④ 미실시)

### 🔴 안보축 매핑 추가는 **하면 안 된다** (2026-08-16 실측) — 그리고 더 큰 문제
"안보축 매핑을 늘려달라" 는 요청으로 후보를 찾다가 **알고리즘 자체의 결함**을 발견했다.

**① 후보가 0건이다**
- 국방위·외교통일위 표결 법안 **40건 중 반대 2표 이상이 3건**, 그중 2건은 이미 매핑됨
- 전 국회에서 반대 15표 이상 나온 법안 **16건 중 안보로 볼 만한 건 1건**(이미 매핑)
- 이름에 안보 키워드(`군|국방|병역|안보|외교|통일|북한|한미|주한|방위|…`)가 있고
  반대+기권 8표 이상인 법안 → **4건, 전부 이미 매핑**
- 구조적 이유: **안보 쟁점(주한미군·전작권·한일관계)은 법률로 표결되지 않는다.**
  대통령·정부 권한이고 국회는 결의안·국정감사로 다룬다. 표결 안건은 **전부 법률안/제정법안**이고
  본회의에 오는 국방·외교 법안은 군인 복지·보상·행정이라 여야가 안 갈린다

**② 넣으면 오히려 나빠진다**
만장일치 법안 10건 추가 시뮬레이션: 안보축 표준편차 **0.230 → 0.060** (4배 더 뭉침).
전원에게 같은 +1 을 더할 뿐이다.

**③ 🔴 진짜 문제 — 축 점수가 상당 부분 "출석률" 을 재고 있다**

| | 상관계수 |
|---|---|
| 불참률 vs **제도축** | **−0.524** |
| 불참률 vs **경제축** | **−0.477** |
| 사용 표결수 vs **제도축** | **+0.673** |
| 사용 표결수 vs 경제축 | +0.487 |

원인은 **매핑 방향 편향 + 본회의 찬성률 97%** 의 조합이다:

| 축 | 찬성=+1 | 찬성=−1 |
|---|---|---|
| institution | 13 | 2 |
| economy | 12 | 3 |
| social | 9 | 4 |
| **security** | **5** | **0** |

분모가 `Σ weight(찬성·반대만)` 이라 불참은 빠진다 → **많이 참여할수록 +1 로 수렴**하고
적게 참여한 사람은 소수 표결에 좌우돼 값이 흩어진다.
즉 유일하게 변별력 있어 보이던 **제도축(sd 0.623)의 변이 상당 부분이 성향이 아니라 출석**이다.

- 🔴 **그래서 "법안을 늘리면 값이 흩어지니 좋아진다" 는 착각이다.** 흩어짐의 정체가
  성향이 아니라 출석 패턴이면, 변별력이 생긴 게 아니라 **노이즈가 성향처럼 보이게** 되는 것이다
- 🔴 **근본 한계: 본회의 표결로는 성향 좌표를 만들 수 없다** (반대가 0.66%뿐).
  매핑을 아무리 늘려도 이 천장은 안 뚫린다
- 다음에 손댈 땐 매핑 개수가 아니라 **① 방향 균형 ② 불참 처리 ③ 표결 아닌 소스**
  (공동발의는 만장일치가 아니라 선택이다) 를 볼 것

### 🔴 진단의 의도를 화면에 쓴다 — `/balance-game` `.bg-why` · `/about` 한계 목록 (2026-08-16)
"문항 20개와 의원 기록을 왜 같은 자로 안 쟀나" · "결국 정당으로 수렴하지 않나" 는 **의도**다 (사용자 설명):
① 일반인에게 법안 수백 건을 읽고 표결하라 할 수 없어 사용자는 가벼운 문항, 의원은 실제 활동으로 각각 기준을 세우고 교집합을 찾는다
② 목적은 정당을 지우는 게 아니라 **당만 보고 찍던 사람이 사람 이름을 한 번 보게 하는 것** — 결과가 익숙한 정당 쪽이어도 실패가 아니다.
🔴 **이 문단을 지우지 말 것.** 없으면 사용자는 진단을 측정 도구로 읽고 위 둘이 결점이 된다. 밝히면 같은 한계가 전제가 된다.
남은 숙제는 **눈금 보정**(문항 부호 ↔ 매핑 법안 부호가 같은 쪽인지) — 두 자를 하나로 만드는 게 아니라 방향만 맞추는 것

#### 눈금 보정 실측 (2026-08-16, `batch/calibrateAxisAnchors.js` · 안보 5문항 제외 15문항)
| 축 | 앵커 법안 | 키워드 추정 정합률 | 눈으로 본 결론 |
|---|---|---|---|
| 경제 | 79 | 84% | ✅ **부호 규약 일치.** ❌ 의 절반은 휴리스틱 오탐, 나머지는 **개별 매핑 오류 5건 안팎** — `최저임금 차등적용→개입`(×2) · `장기보유특별공제 축소→시장` · `자사주 소각 의무화→시장`(×3, AI 가 "시장 규율 강화" 를 시장으로 읽음) |
| 사회·문화 | 35 | 97% | ⚠️ 부호는 맞는데 **변별력이 없다.** 문항이 묻는 가치 쟁점(동성혼 1건 · 사형제 6건 · 포괄적 차별금지법 2건)이 코퍼스에 거의 없고, `전통` 극은 마약·처벌 강화 같은 **여야 합의 법안**이 채운다 — 마약 처벌 강화 17건 중 10건의 서명자 사회축 평균이 `+0.1~0.25`(자율 쪽). "처벌 강화" 는 성향이 아니라 상식이라 축을 못 가른다. **v1↔v2 사회축 상관 −0.22 의 원인** |
| 정치제도 | 81 | 68% | 🔴 **개념이 어긋난다.** AI 라벨 `안정|개혁` 은 "바꾸나/두나" 이고 문항(q16~q20)은 "권한 분산·견제 vs 유지·집중" 이다. 겹치는 건 q16 검찰(수사권 분리·공수처 = 개혁 = +1)뿐. 어긋나는 예: `헌재 재판관 자격 제한→개혁`(문항은 독립 강화 = −1) · `선관위 중립성 강화→안정` · `대법관 증원→안정` · **`내란죄 처벌 강화·구속기간 연장→안정`**(AI 가 "질서·헌정 수호" 를 안정으로 읽어 민주당 서명자를 안정 쪽으로 민다 — 파일럿에서 본 "안정 셀 절반이 질서·처벌" 과 같은 문제) |

- 서명자 좌표 방향(③)은 경제 23/25·9/11 처럼 대체로 맞고, 사회축만 낮다 (위 표) — 그 법안이 좌표에 이미 들어가 있어 순환적이라 참고용
- 🔴 **결론: 부호는 뒤집힌 데가 없다.** 문항 옵션 점수를 손댈 것은 없다. 고칠 곳은 매핑 쪽이다:
  ① 경제 개별 오류 5건 UPDATE (크레딧 0) ② 사회·제도는 `mapBillAxisPilot.js` 의 축 라벨 정의를 문항이 재는 것에 맞게 고쳐 **재분류**해야 한다
  (`제도`: 안정|개혁 → "권한 집중·현행 유지 | 권한 분산·견제·투명" / `사회`: 처벌·규제 강화 일반을 `전통` 에 넣지 않게) — 해당 위원회 법안 2~3천 건 ≈ $2~3
- ⚠️ 키워드 추정은 지침이지 판정이 아니다. 숫자만 보고 결론 내지 말고 ❌·? 행을 읽을 것 (q16 은 규칙을 한 번 조여서 58→68% 가 됐다 — 휴리스틱 몫이 그만큼 크다)

#### 재분류 실행 (2026-08-16 저녁) — `mapBillAxisPilot.js --reclassify social,institution` · 프롬프트 `axis-p2` · 5,544건 · **$6.53** · 27분
프롬프트의 사회·제도 축 정의를 문항이 재는 것에 맞게 고쳤다 (파일 상단 `🔴 social · institution 에서 특히 지켜야 할 것`):
사회 = 가치 대립이 실제로 있는 사안만(처벌 강화 일반은 **none**) / 제도 = "바꾸나/두나" 가 아니라 **"권력을 어디로 옮기나"** (기관 독립성 강화·수사권 확대·공수처 폐지 = 안정, 견제·분산·공개·대통령 권한 제한 = 개혁). 경제 개별 오류 5건은 손으로 뒤집었다 (`prompt_version='axis-p2-manual'`).

| 이동 (이전 → 새) | 건수 | 뜻 |
|---|---|---|
| institution+ → **none** | 675 | "바꾼다 = 개혁" 이던 것들 |
| social− → **none** | 657 | 처벌·단속 강화 일반 (전통이 아니었다) |
| social+ → none / economy+ | 504 / 166 | 소비자 보호·정보 규제 = 개입이지 자율이 아니다 |
| institution+ → institution− | 87 | 기관 독립성 강화를 개혁으로 봤던 것 |
| social+ → social+ · institution+ → institution+ | 821 · 1,591 | 그대로 |

**전후 비교** (균형 선별 → v2 미러링 → `calcPoliticianAxis` 재계산 → `calibrateAxisAnchors` · `validateAxisPilot` 재실행):

| | 재분류 전 | **재분류 후** |
|---|---|---|
| v2 매핑 (경제·사회·제도) | 2,104 · 1,962 · 788 | 2,138 · **494** · **374** (희소 셀: 전통 247 · 안정 187) |
| 좌표 있는 의원 (서명≥5) | 297 · 295 · 294 / 세 축 292 | 298 · **273** · **287** / 세 축 **269** |
| 축당 서명 중앙값 | 76 · 68 · 30 | 80 · **18** · **17** |
| 분할-반 신뢰도 | 0.88 · 0.76 · 0.71 | 0.88 · **0.63** · **0.60** |
| 정당 η² | 77 · 53 · 73% | 81 · 50 · 59% |
| 앵커 부호 정합 (키워드 추정) | 84 · 97 · 68% | **89** · 100(앵커 5건뿐) · 64% |
| 정당 평균 (민주 / 국힘) 사회 · 제도 | +0.20/−0.19 · +0.33/−0.28 | +0.31/−0.18 · +0.42/−0.15 |

- ✅ **타당성은 올라갔다** — 제도축 ❌ 를 눈으로 다시 보니 대부분 휴리스틱 오탐이고 라벨은 맞다 (`검사 수사권 확대→안정` · `공수처 폐지→안정` · `탄핵 요건 강화→안정`).
  마약 처벌 강화 17건은 전부 none 으로 빠져 사회축에서 "상식이 성향으로 잡히던" 문제가 사라졌다
- ⚠️ **신뢰도는 내려갔다** — 사회 0.76→0.63 · 제도 0.71→0.60. 옛 값은 **틀린 것을 안정적으로 재던 값**이라 되돌릴 이유는 없지만,
  0.8 기준선에서 더 멀어진 건 사실이다. 원인은 하나 — **희소 셀(전통 247 · 안정 187)이 축의 크기를 정한다.** 올리는 길은 그 두 셀을 사람이 검토해 채우는 것뿐
- ⚠️ 사회축 탈락이 정당별로 고르지 않다 — 민주 24/161(15%) vs 국힘 7/109(6%) 가 좌표 없음. 서명 5건 하한에 걸린 것이라 매핑이 늘면 풀린다
- ⚠️ 사회 문항 5개 중 앵커가 남은 건 **청소년 게임 규제 뿐**(5건). 동성혼·사형제·차별금지·마약은 이제 법안이 0~2건이다 → **사회 문항 교체(3단계)가 다음이다** — 매핑 안의 사회 법안 494건을 주제별로 세어 양방향이 있는 쟁점에서 고른다
- 🔴 `--reclassify` 뒤 선별은 `--target 100000` 이 기본이다. 기본 300 그대로 두면 셀당 38 로 `is_selected` 를 통째로 덮어쓴다 (실제로 한 번 그랬다 — `--sync-v2` 를 안 넘겨 v2 는 무사했다)

#### 3단계 — 종합팩 사회 문항 교체 (2026-08-16 밤, `ddl/migrations/2026-08-16-balance-social-questions-v2.sql`)
매핑 안 사회 법안 494건을 법률 단위로 세어 **양방향 법안이 실제로 있는 쟁점**으로 바꿨다. 사용자 결정: 4개 채택 · 새 id 방식.

| 옛 (비활성) | 새 | 앵커 (전통/자율) |
|---|---|---|
| q6 차별금지법 | **q21 집회·시위 규제** | 집시법 17/9 |
| q7 동성혼 | **q22 온라인 표현 규제** (명예훼손·허위정보) | 정보통신망법 22/11 + 형법 명예훼손 |
| q8 사형제 | **q23 이주민·외국인 권리** | 공직선거법 외국인 선거권·난민법 / 출입국관리법 8 |
| q10 마약 처벌 vs 재활 | **q24 촉법소년·소년범** | 소년법 10/0 (편측 — 축 균형은 축 단위라 허용) |
| q9 청소년 게임 | 유지, 문구를 게임·SNS 로 넓힘 | 게임산업법 5 + 정보통신망법 SNS 제한 |

- 🔴 **기존 id 를 덮어쓰지 않았다** — q6·q7·q8·q10 은 `is_active=FALSE` 로 남고 응답도 남는다. 덮어쓰면 옛 응답이 새 문항 답으로 둔갑한다
- 🔴 **`BalanceGameDao.recomputeUserAxisScore` 는 활성 문항의 응답만 집계한다** (조인 추가). 안 그러면 옛 응답이 좌표에 계속 섞이고
  완료 판정(20/20)도 옛 응답으로 채워져 새 문항을 안 풀어도 완료가 된다. `getPackProgress.answered_count` 도 활성 기준
- 기존 응답자 6명은 재계산 후 **16/20 · 미완료**로 돌아갔다 (사회축이 q9 하나로 임시 계산됨). 이어하기가 6번 문항(q21)부터 열린다 — 실측 확인
- ⚠️ `balance_game_seed_v1.sql` 을 다시 돌리면 ON CONFLICT 가 q6~q10 을 되살린다 → 시드 뒤에 이 마이그레이션을 다시 실행할 것 (시드 파일 상단에 적어둠)
- 보정 재실행: **사회 앵커 5 → 101건 · 부호 정합 95%** · 서명자 방향 69/101. 이제 세 축 모두 문항 ↔ 매핑 법안이 같은 쟁점을 본다
#### 🔴 희소 셀(전통·안정) 사람 검토 — 해봤고, **거의 안 나온다** (2026-08-16 밤, `batch/findRareCellCandidates.js`)
신뢰도(사회 0.63 · 제도 0.60)를 올리려면 희소 셀을 채워야 해서 후보를 뽑았다. **결론: 코퍼스에 없다.** 다시 하기 전에 이걸 읽을 것.

| 탐색 | 결과 |
|---|---|
| 주제어 그물 (`외국인`·`집회`·`검찰` 단어) | 2,943건 — 사람이 볼 수 없는 양 |
| 주제어 + **방향 동사** (`외국인…제한`, `검사 수사권…확대`) | 666건. 그중 **B(반대 방향으로 분류된 것)는 읽어보니 거의 전부 AI 가 맞았다** (특검·공수처 확대 = 개혁) |
| 서명자 85%+ 한 정당 · none · 법사/행안/운영 · 넓은 주제어 | 812건. 국힘 다수 법사위 none 을 읽어보니 **전부 처벌 강화 일반·법원 신설·행정 정비** — 안정 셀 후보 0 |
| 사회 A(none) 5주제 직접 판독 | 전통으로 건질 건 **2건**(공직선거법 외국인 지방선거 선거권 요건 강화 ×2 → `prompt_version='human'` 로 반영, 전통 247→249) |

- 🔴 **안정 셀이 187건인 건 AI 가 못 찾아서가 아니라 22대 코퍼스에 그런 법안이 그만큼뿐이라서다.** "기존 권력기관 권한 유지·강화" 법안은
  이번 국회에서 구조적으로 적게 발의됐다 (검사 수사권 확대 1건에 110명이 서명하는 식으로 **건수는 적고 서명은 몰린다**)
- → 신뢰도를 여기서 더 올릴 방법은 없다. **화면이 이미 한계를 말하고 있고(`.pv-basis`·`.bg-why`·법안 N건 각주), 분기 갱신 때 새 법안이 셀을 채우길 기다리는 것**이 답이다.
  🔴 정당 서명 비율을 라벨로 쓰고 싶어지면 참을 것 — 그건 "당 말고 사람" 을 코드로 부정하는 것이다. 후보 탐색 신호로만 썼고, 그마저 수확이 0 이었다
- 산출물 `out/rare-cell-candidates.md` (1,412건 · 부류 A/B/C/D/E · 적용 SQL 템플릿). 사람이 넣은 라벨은 `prompt_version='human'` — `--reclassify` 가 건너뛴다

- 뺀 셋(차별금지·동성혼·사형제)은 주제팩(`gender` 등)으로 옮길 후보 — 종합팩 = 의원 매칭 기준. ⚠️ 주제팩 4종(labor·housing·security·gender, 각 10문항)은 **DB 에 활성 상태로 있다** — 전부 같은 4축에 합산되므로 앵커 없는 문항이 사용자 좌표에 섞인다. 역할 분리(주제팩 = 자기 이해, 매칭 축 기여는 앵커 문항만)는 아직 안 했다

### 🔴 성향 일치도 로직 점검 (2026-08-16) — **% 를 주인공으로 되돌리지 말 것**
사용자 지적("수치가 정확히 뭘 의미하는지 알기 어렵다")으로 파이프라인 전체를 실측했다.

**✅ 부호는 정상이다.** 사용자측(`종부세 강화 = +1`)과 의원측(`분배 세제 찬성 = +1`) 모두
`+1 = 개입/자주` 로 일치한다. 방향 뒤집힘 같은 버그는 없다.
⚠️ CLAUDE.md 의 `SIDE: economy 시장/개입` 표기는 **앞이 음수, 뒤가 양수**라는 뜻이다 (헷갈리기 쉽다).

**❌ 그러나 통계로서는 약하다:**

| | 실측 |
|---|---|
| 매핑 법안 | **48건**뿐 — 제도 15 · 경제 15 · 사회 13 · **안보 5** |
| 재료의 변별력 | 매핑 법안의 반대표 비율이 제도 13.5% / 안보 4.4% / **경제 2.9% / 사회 2.6%**. 반대 10표 이상 나온 법안은 48건 중 **12건** |
| 좌표 뭉침 | **안보축은 294명 중 247명(84%)이 정확히 1.00** |
| 축별 표준편차 | 경제 0.210 · 사회 0.213 · 안보 0.230 vs **제도 0.623** → 거리의 대부분을 **제도축 하나**가 결정 |
| 일치도 범위 | 실측 **23.3~90.4%** (평균 65.6%). 이 문서에 적혀 있던 `[1%, 59%]` 는 **낡은 값**이었다 |

원인은 하나다 — **좌표를 본회의 표결로 만드는데 본회의는 반대표가 0.66%밖에 안 된다.**
즉 이 좌표는 "의원의 성향" 보다 "그 48개 법안의 찬성 방향" 을 재는 쪽에 가깝다.

**→ 그래서 화면을 이렇게 바꿨다:**
- 🔴 **주인공은 `%` 가 아니라 순위다** (`294명 중 41위`). % 는 분모 **1.5** 라는 **임의 보정값**에
  의존하지만 **순위는 거리의 단조 변환이라 그 보정과 무관**하다. 지금 데이터로 정직하게
  말할 수 있는 건 순위까지다. % 는 `근사 일치도 61%` 로 괄호 안 보조로만 남긴다
- 🔴 **변별력 없는 축은 해석을 내놓지 않는다.** 안보축에 "둘 다 자주 쪽" 이라고 쓰면
  **거의 전원에게 같은 말**이라 아는 게 늘지 않는데 안다고 착각하게 만든다.
  대신 `의원 84%가 같은 값이라 이 축은 사람을 가르지 못합니다` 를 쓴다.
  경계는 `mode_share >= 0.5`(의원 절반 이상이 한 값) — 실측상 안보만 걸린다
- 🔴 **`법안 48건으로 만든 좌표` 각주는 필수다.** 빼면 순위가 정밀한 값으로 읽힌다
- 홈의 `나와 맞는 의원` 카드도 % 를 빼고 **순번(1·2·3)** 만 쓴다 — 정렬은 보정과 무관하다
- 쿼리는 `getMatchContext.sql` (순위 + 축별 변별력 + 매핑 법안 수). 294행이라 비용 없음

**근본 해결은 매핑 법안을 늘리는 것**이다 (특히 안보 5건). 그 전까지 % 를 키우지 말 것.
⚠️ 매핑이 늘면 이 문서의 실측값도 같이 갱신할 것 — 낡은 `[1%, 59%]` 가 그렇게 남았다.

### 🔴 홈 재구성 (2026-08-16) — 뺀 것을 되살리기 전에 이 실측을 읽을 것
구 홈은 **재고 목록**이었다. 섹션 6개 중 4개가 값을 못 했고 하나는 **틀리게 읽혔다**:

| 뺀 것 | 실측 근거 |
|---|---|
| KPI 5칸 | 전부 총량(전체 법안 18,741 · 등록 의원 299). "그래서?" 에 답하지 않는다 |
| 최근 정당 이동 | `politician_party_memberships` 의 종료 기록이 **전체 2건**. 섹션 하나를 캐러셀로 쓰는데 카드 2장 |
| 최근 표결 결과 | 최근 20건이 **전부** 찬성 ≥ 반대×10 (평균 **찬성 186 vs 반대 1.1**). 같은 그림 20번 |
| 가장 활발한 의원 | 발의 **건수** 랭킹 = 양 지표. 사이트 곳곳에 "건수는 기여도가 아니다" 라고 써놓고 홈에선 순위표였다 |
| 월별 처리 추이 | 🔴 **오해를 만든다.** 처리 완료 비율이 창 안에서 `25.5% → 6.7% → 0.6% → 0.0%` 로 떨어지는데 그건 **처리 지연**이다. `/xray` 월별추이엔 이 각주가 있는데 홈 차트엔 없었다 |

- DAO·서비스 메서드(`getRecentVotes`·`getTopProposers`·`getMonthlyTrend`·`getRecentPartyMoves`)는
  **남겨뒀다** — 다른 페이지가 쓰거나 나중에 되살릴 수 있게. 홈 컨트롤러에서만 뺐다
- 구 홈 전용 CSS **66개 규칙**(`.kpi-*`·`.pm-*`·`.vote-*`·`.politician*`)도 같이 제거 (참조 0 확인)

#### 홈 2·3차 재구성 (2026-08-16 같은 날) — 히어로는 **신문 1면 마스트헤드**, 그 아래 무작위 의원 3명 가로 3단
순서: `히어로(날짜줄 → 세리프 헤드라인 → 데크 → 텍스트 링크 → 어제 브리핑 한 줄 → 의원 3명 축 좌표 3단) → 나와 맞는 의원 → 국회 브리핑 → 숫자로 본 국회(결론 3숫자 스트립 + 진입 카드 3장)`
- 🔴 **구 히어로를 되살리지 말 것** — 100vh · 펄스 점 mono 라벨 · Bebas 3행 워드마크 · 그라디언트 글로우 · 알약 버튼 2개 · 페이드업 애니메이션.
  전형적인 "스타트업 랜딩" 문법이라 AI 냄새가 났고 화면 하나를 통째로 먹었다 (사용자 지적). 지금은 내용만큼만 (실측 히어로 734px · 문서 2,238px, 구 3,000px+)
- 헤드라인은 **Noto Serif KR 900** (`/xray` 카드 제목·법안 분석 헤드라인과 같은 시각 언어), 버튼 대신 **텍스트 링크**(첫 번째만 골드 밑줄).
  날짜줄은 `Intl.DateTimeFormat(… timeZone:'Asia/Seoul')` (로컬 getter 금지) + 어제 브리핑 `stats.proposed`. 어제 브리핑 헤드라인 한 줄이 "속보" 자리
- 의원 3장은 글 아래 **전체폭 세로 스택** (왼쪽 인적사항 220px | 오른쪽 막대 3줄, 막대 ~590px · 글자 14/12.5px).
  가로 3단(399px)은 글자가 10px 까지 내려가 안 읽혔고, 2열(글|카드)은 글이 304px 에서 끝나 카드 열 아래 227px 이 빈다 (둘 다 실측)
- 축 행은 `축 이름 + 무엇을 다루는지(AXIS_META.short)` | 긴 양끝 라벨 | 막대. **정당 평균은 진한 세로선 + 삼각캡**(사이트 공통 평균 마커 언어),
  범례는 제목 바로 옆. **≤768 은 축 행을 한 줄 유지** — 양끝을 짧은 라벨(`.ls`)로 바꾸고 `상세 →` 를 숨긴다.
  세 줄로 접었더니 카드 337px × 3 = 1,197px 로 홈의 1/4 을 먹었다 (실측). 한 줄이면 188px. 🔴 이 규칙은 900px 블록 **뒤**에 있어야 한다 (같은 특이도, 파일 순서)
- **모바일 실측 (375px, 2026-08-16)**: 홈 문서 4,193 → **3,554px** (의원 카드 압축 · 진입 카드 설명 2줄 클램프 · 스트립 설명 숨김 · 브리핑 본문 3줄).
  의원 상세는 **7,330px** — 분석 탭 카드 5장(표결 성향 1,733 · 대표발의 1,437 · 발언 1,337 · 정당협력 913 · KPI 469)이 6,179px 로
  구조적이다. `.ov-toc` 칩이 점프를 맡는다. 더 줄이려면 모바일에서 카드 접기(아코디언)가 다음 후보
- 홈은 `.pb-section` 여백을 72 → **48px** 로 조인다 (페이지 로컬 오버라이드)
- 왜: 홈이 "국회는 이렇다"(숫자)로 시작했는데 이 사이트의 차별점은 **"의원 한 명 한 명이 이렇다"** 다. 남의 좌표를 보고 나면
  "나는 어디지" 가 다음 질문이라 바로 아래가 「나와 맞는 의원」이다
- 🔴 **좌표만 보여주면 아무 뜻이 없다 — 소속 정당 평균 눈금을 같이 찍는다** (`getAxisSpotlight.sql`, 정당 평균은 좌표 있는 의원 전체 기준).
  같은 당인데 평균에서 얼마나 떨어져 있는지가 곧 "당 말고 사람" 의 증명이다. `party_n < 3` 이면 눈금을 안 그린다
- 🔴 **무작위다.** 편집 개입이 없어야 중립이다 — 정당 안배도 하지 않는다 (안배가 곧 편집). 현직·세 축 다 있는 의원만 (`active_yn`, 홈 KPI 와 같은 판단)
- 막대 문법은 의원 상세 `.pv-band` 와 같다 (왼끝 L·오른끝 R·골드 점). 비교 대상이 "나" 가 아니라 정당 평균이라 **세로 눈금**으로 그린다
- **`주목할 법안` 섹션은 뺐다** (사용자 결정). `getTrending`·`/api/bills/trending` 은 남아 있다 (다른 곳이 쓸 수 있게)
- 구 홈 CSS(KPI·trending·표결 표·정당 이동·카테고리 탭 232줄)와 `resultClass`/`termHash`/`fmtDate`(로컬 getter) 헬퍼를 이때 제거 — 참조 0 확인
- 실측: 히어로 좌 460 / 우 531px (1280), 모바일 375 가로 오버플로 0

#### 결론 3숫자 — 이제 「숫자로 본 국회」 머리의 스트립이다 (`getHomeFacts.sql`)
🔴 **순서가 곧 논리다.** 하나를 빼거나 순서를 바꾸면 이야기가 끊긴다:

| | 숫자 | 말하는 것 |
|---|---|---|
| ① | 계류 **75.8%** | 발의된 법안 4건 중 3건은 아직 위원회에 있다 (18,741 중 14,199 · 가결은 602) |
| ② | 본회의 반대 **0.66%** | 표결 177,260건 중 반대 1,175건. **걸러지는 곳은 본회의가 아니라 위원회**다 |
| ③ | 불참률 중앙값 **20.7%** | 그런데 의원 절반은 다섯 번 중 한 번 이상 자리에 없다 (모수 100건+ 304명) |

- ⚠️ ③ 은 **의원별 비율의 중앙값**이지 전체 불참 비율(24.75%)이 아니다. 전체 비율은 표결이 많은
  의원에게 가중되고, 중앙값이라야 "보통 의원" 을 말한다. 둘을 섞지 말 것
- 🔴 쿼리가 `bills`(18,741) + `bill_votes`(177,260) 전체 집계라 실측 **115ms** →
  서비스에서 **10분 캐시 + inflight 공유**. 홈은 가장 많이 열리는 페이지다
- ⚠️ 실패하면 `facts` 가 null 이고 히어로 숫자 블록만 빠진다 (홈은 산다)
- ⚠️ 숫자를 화면에 하드코딩하지 말 것 — 배치가 매일 움직인다

#### 새로 넣은 것
- **국회 브리핑** — 매일 쌓이는 유일한 신규 콘텐츠인데 홈에 없었다. 최신 1장 + 최근 3장.
  ⚠️ `briefing_date` 는 `'YYYY-MM-DD'` **문자열**이다. `new Date()` 로 파싱하지 말 것 (타임존)
- **나와 맞는 의원** (`getTopMatches.sql`) — 성향 진단이 핵심 기능인데 홈에 진입로가 없었다.
  🔴 일치도 식(`거리/2`, `(1-d/1.5)*100`)은 **의원 상세·목록과 글자 그대로 같아야** 한다
- **숫자로 본 국회** — `/xray`·`/xray/chart`·`/politician` 진입 카드 3장.
  ⚠️ 여기에 지표 숫자를 다시 그리지 말 것 (히어로 결론 3칸과 겹친다)

### 방문 통계 — 관리자 전용 `/admin/stats` (2026-08-16)
"사이트가 얼마나 쓰이나 / 어느 페이지가 보이나" 를 운영자가 알 방법이 없었다. **공개 카운터가 아니라 관리자 화면**이다 —
초기엔 작은 숫자가 신뢰도를 깎고(CHANGELOG 4057행), 조회 순위를 공개하면 그 자체가 편집이 된다.

```
middlewares/pageViews.js               ← 수집 (60초 메모리 버퍼 → UPSERT). app.js 의 passport 뒤에 등록
ddl/migrations/2026-08-16-page-views.sql ← page_views_daily · user_visit_days
daos/queries/admin/getStats*.sql       ← 읽기 5종 / views/admin/stats.ejs
```

- 🔴 **개인정보를 남기지 않는다.** IP·UA·리퍼러·방문자 식별자는 DB 에 안 간다 — 일별 × 페이지종류(× 상세 대상) **합계만**.
  유니크 판정은 프로세스 메모리(하루 단위 Set)에서만 한다 → **재시작하면 그날 방문자가 다시 세어질 수 있는 근사값**. 화면 각주에 적혀 있다
- 🔴 **로그인 회원은 `user_visit_days(user_id, visit_date, views)` — 날짜 단위 접속 여부뿐, 어느 페이지를 봤는지는 없다.**
  정치 사이트에서 "누가 어느 의원 페이지를 봤나" 는 민감한 열람 기록이라 만들지 않는다. 사용자별 페이지 로그를 추가하지 말 것.
  개인정보처리방침 1항(자동 수집)·6항(쿠키 `_v`)에 적혀 있다 — 범위를 바꾸면 거기도 같이
- 🔴 **봇 필터가 생명선이다** (08-14 크롤러 116,880건이 세어지면 그래프가 죽는다): UA 패턴 + **`Sec-Fetch-Dest: document`**
  (curl·대부분의 크롤러는 안 보낸다) + `Accept: text/html` + 정적·API·`/admin`·`/auth`·`/my`·robots/sitemap·`/xray/s/`·
  브리핑 card/threads 제외 + 응답 200·text/html 만. 완벽하지 않으므로 **Cloudflare 대시보드와 같이 본다**
- 방문자 식별은 경량 쿠키 **`_v`**(랜덤 16hex · 1년 · httpOnly). **세션을 만들지 않는다** — `saveUninitialized:false` 라
  비로그인은 세션이 없고, 방문자마다 세션 행을 만들면 `session` 테이블만 불어난다. cookie-parser 가 없어 헤더를 직접 파싱
- 요청마다 DB 를 치지 않는다 — 60초 버퍼 후 UPSERT 한 번(`views += · uniques +=`). SIGTERM/SIGINT 에 마지막 주기분 flush(3초 상한).
  flush 실패는 로그만 남기고 버린다 — 통계 때문에 서비스가 흔들리면 안 된다
- 페이지 분류 `PAGE_KINDS`(미들웨어 단일 소스, `KIND_LABEL` 을 화면이 쓴다). 상세는 `target_id`(bill_id·mona_cd·briefing id)를 같이 잡아
  **의원·법안·브리핑 TOP 20** 을 낸다 — Cloudflare 무료 플랜이 못 주는 유일한 것. `site` 행이 전체 총계
- 구 `utils/visitorCounter.js`(JSON 파일 저장 — Railway 휘발 FS 에서 재배포마다 0)는 이걸로 대체·삭제됐다
- 검증 2026-08-16: curl 요청은 Set-Cookie 없음(미집계) / 브라우저 헤더 요청은 `_v` 발급 · 60초 후 `site 6/3 · home 3/3 · politician_detail JC14718Q 1/1` UPSERT 확인 · 뷰 렌더 정상

### 소개 페이지 재작성 (2026-08-16)
구 버전이 **사실과 어긋나 있었다**: 첫 문단이 `공약 이행도` 를 제공하는 것처럼 썼는데(만든 적 없음),
`295명` 을 하드코딩했고(실제 309), 기능 목록에 브리핑·차트 만들기·발언 기록·상임위 참여율·특화 분야가
전부 빠져 있었다. 로드맵 5개는 `제공 중` 배지와 섞여 구분이 안 됐다.

- 🔴 **`데이터 출처와 한계` · `중립성을 지키는 방법` 두 섹션을 지우지 말 것.**
  이 사이트의 차별점은 "데이터가 많다" 가 아니라 **"무엇을 모르는지 밝힌다"** 인데
  구 소개엔 그 얘기가 한 줄도 없었다
- 🔴 **로드맵에 `제공 중` 배지를 붙이지 않는다.** 그리고 구 버전의 **"정치인의 미래 행동을 예측"**
  항목을 되살리지 말 것 — 중립성 원칙과 정면 충돌한다
- ⚠️ 소개에 정확한 수를 박지 말 것. "약", "가까이" 로 쓰고 정확한 값은 각 페이지가 매일 집계해 보여준다
- ⚠️ `.direction-item` 은 **좌측 정렬**이다 (구 `text-align: center`). 본문이 3~4줄이라
  가운데 정렬이면 줄머리가 들쭉날쭉해 읽기 어렵다. Font Awesome 아이콘도 함께 제거
| `/privacy` | `privacy.ejs` | 개인정보처리방침 (2026-07-29, AdSense 대비 광고 쿠키 조항 포함) |
| `/terms` | `terms.ejs` | 이용약관 (AI 분석 면책·게시물 정책) |
| `/glossary` | `glossary.ejs` | 용어 설명 (목차 + 4섹션) |
| `/auth/login` | `auth/login.ejs` | 구글/카카오 로그인 |
| (404/403) | `error_pages/404.ejs` | 찾을 수 없음·권한 없음 공용. `{ pageTitle, pageStyles:'error', message, code?, detail? }` — `code` 생략 시 404 |
| (500) | `error_pages/500.ejs` | 전역 에러 핸들러 전용. locals 의존 최소화 (에러 처리 중 렌더라 실패하면 안 됨) |
| `/auth/setup` | `auth/setup.ejs` | 신규 OAuth 닉네임·성별·연령대 설정 (필수) |

### `/bill/:id` 5-Zone AI 분석 UI (2026-04-27 전면 리디자인)
`bill_ai_analysis` 테이블에 레코드가 있을 때만 5-Zone 렌더. 없으면 `.bill-basic-header` + **법안 원문 섹션** + 분석 요청 위젯 노출.

#### 미분석 분기 헤더는 Zone 1 과 **같은 구성**이다 (2026-08-15)
`.bill-basic-header` 도 `메타 2줄 → 발의자 스택 → 법안명` 순서로, Zone 1 과 같은 요소·같은 토큰을 쓴다.
차이는 **AI 산출물(한 줄 요약 44px·카테고리·읽기시간)이 없다는 것뿐**이다.

- 🔴 **왜 바꿨나 — 미분석 법안은 공동발의자를 볼 방법이 아예 없었다.** 발의자 전용 섹션(구 Zone 10)이
  Zone 1 통합과 함께 폐기됐는데 **이 분기만 통합에서 빠져** `공동발의 N인` 텍스트 한 줄만 남아 있었다
- 마크업 단일 소스는 **`views/bill/_proposer_stack.ejs`** — 두 분기가 같은 파샬을 쓴다
  | 분기 | 경로 |
  |---|---|
  | 미분석 | 헤더에서 바로 `include` (SSR) |
  | 분석 있음 | 숨은 홀더 `#proposer-stack-src` 에 SSR → `mountBillAnalysis` 가 `proposerStackHtml` 로 받아 Zone 1 에 삽입하고 홀더 제거 |
- ⚠️ **`interactions.js` 의 `buildProposerStack` 은 폴백일 뿐이다.** 스택을 고칠 일이 생기면 **파샬을 고칠 것** —
  JS 쪽만 고치면 두 분기가 서로 달라 보인다
- ⚠️ `--ba-*` 토큰 선언에 `.bill-basic-header` 를 같이 넣어야 한다. 빼면 이 분기에서 `var()` 가 해석되지 않아
  색·폰트가 통째로 무너진다. 같은 이유로 `.ba-meta-line` 계열 규칙도 `.ba-z1` 단독 스코프면 안 된다

**디자인 토큰** (분석 섹션 전용 — `.bill-ai-analysis` 스코프):
- 컬러: `--ba-ink #0F1B1F` (본문) / `--ba-sub #374151` (보조) / `--ba-meta #646E7E` (메타) / `--ba-gold #8F5800` (강조 단일색, 머스타드)
  - ⚠️ **소형 텍스트 색은 대비비로 정한다** (2026-08-11 감사). 12~14px 는 WCAG AA 4.5:1 필요:
    - `--ba-meta` 는 `#6B7280` 이었는데 **4.47** 로 아슬하게 미달 → `#646E7E` (4.76~4.93). 육안 차이는 거의 없다
    - `.ai-analysis-label.is-done` 의 `color` 는 `--accent #B8740C` 였는데 배경 `#FAF6EB` 위에서 **3.51** → `#8F5800` (5.46). **"AI가 생성한 분석으로 사실과 다를 수 있습니다" 는 법적·윤리적 고지라 안 읽히면 안 된다**
    - `.label-meta` 의 `opacity: 0.8` 제거 — 배경과 합성돼 5.46 → 3.66 으로 떨어진다. 톤은 색으로만 낮출 것
  - 검증된 본문 타이포(수정 불필요): Z1 요약 44px/900, Z3 본문 18px·lh 1.75·**줄당 49자**(한글 정독 최적 45~50), Z2 카드 18px·줄당 20자
- 카드: `--ba-card-bg #FAFAF7` / `--ba-card-border #E8E5DC` / radius 16px / padding 32px
- 폰트: `Pretendard Variable` (본문 18px / weight 450 / line-height 1.75) / `Noto Serif KR` (헤드라인) / `JetBrains Mono` (메타 letter-spacing 0.18~0.22em)
- 강조: `<strong>`/`<em>` → weight 700 + `text-decoration: underline` 골드 (offset 6px / thickness 2px)
- **정치색 배제**: 빨강/파랑/초록을 입장 라벨에 쓰지 않음. 위계는 타이포·여백·위치로만

**레이아웃** (`.ba-shell` 1240px = 180 좌마진노트 거터 + 880 콘텐츠 + 180 우인덱스 거터):
- bd-wrap(960px) 제약을 깨고 100vw 로 break out (`margin-left: calc(50% - 50vw)`)
- 콘텐츠 `.ba-content` max-width 880px (롱폼 정독 폭)
- 섹션 간격 64px, 모바일 48px

- **AI 분석 라벨** (분석 분기 공통, 2026-04-26): 분석 섹션 위 한 줄 — 분석 있음은 골드 톤(`is-done`), 없음은 회색 톤(`is-pending`). [ANALYSIS.md](./ANALYSIS.md) §7-장치4 디스클레이머 충족
- **Zone 1 — 메타 + 헤드라인 + 발의자 스택** (`#ba-summary`):
  - 메타 1줄 `#번호 · 위원회 · 결과` (mono 12px, letter-spacing 0.22em, `--ba-meta`)
  - 메타 2줄 `발의일 YYYY.MM.DD` 만 (대표발의자/공동발의 N인 은 발의자 스택이 대체)
  - **발의자 컴팩트 스택** (`.ba-proposers`, 2026-04-27 신규 · 2026-08-15 EJS 파샬로 이관):
    - 🔴 **마크업 단일 소스는 `views/bill/_proposer_stack.ejs` 다.** 아래 "미분석 분기 헤더" 참조 —
      두 분기(분석 있음/없음)가 같은 파샬을 쓴다. JS 에 마크업을 다시 만들지 말 것
    - 좌: 가로 아바타 스택 (대표 32px·골드 외곽선 / 그 외 24px·overlap), 최대 10명
    - 가운데: `{대표명} 외 N인 · {정당분포}` 라벨 (1정당이면 "모두 X", 다정당이면 "X 7, Y 3")
    - 우: "전체 보기 ▾" 토글 → 5열 카드 그리드 펼침 (대표 카드만 골드 외곽선 + 작은 "대표" 라벨)
      - 토글은 **document 위임 리스너**(`interactions.js`)가 처리한다 — SSR·JS 어느 쪽이 그렸든 동작
    - 정당색 사용 안 함 (정치색 회피). 강조는 골드 단일색
    - 🔴 **퇴임 의원(`name` 이 null)은 링크를 걸지 않는다.** `bill_co_proposers` 엔 mona_cd 가 남지만
      `politicians` 는 현직만 담아 조인이 비고, 그 mona_cd 로 가면 **상세가 404 다** (실측 `TRE2429O`).
      `mona_cd` 유무만 보고 링크를 걸면 안 된다 — CSS `cursor: default` 는 앵커 클릭을 막지 못한다
    - 모바일 ≤768: 아바타 축소(28/22), 라벨·토글 다음 줄, 그리드 5→2열
      - 🔴 **2열 규칙은 특이도를 맞춰야 한다** (2026-08-15 수정). 5열을
        `.ba-proposers[data-expanded="true"] .ba-proposers-grid`(0,3,0)가 선언하므로
        미디어 쿼리에서 `.ba-proposers-grid`(0,1,0)로 쓰면 **순서와 무관하게 절대 못 이긴다.**
        이 문서엔 "5→2열" 이라 적혀 있었지만 실제로는 **375px 에서도 5열이 나오고 있었다**
  - 법안 원제목 `<h1>` 세리프 700 / 24px (작게)
  - 한 줄 요약 `<h2>` 세리프 900 / **44px** / line-height 1.15 + **좌측 4px 골드바 only** (박스/배경 X)
  - 태그라인: 카테고리·읽기시간·결과를 텍스트 메타로 (`환경·에너지·기후기술 · 읽기 2분 · 수정가결`, 14px `--ba-meta`)
  - 국회 원문 링크 (mono 12px, currentColor 보더라인)
- **Zone 2 — 핵심 변화 3카드** (`#ba-changes`, 2026-08-11 가시성 개편):
  - **비대칭 grid 8fr / 4fr / 4fr** (큰카드 18px / 작은카드 16px)
  - ⚠️ **이전에는 세 카드가 배경도 라벨색도 전부 같았다** (`#FAFAF7` + 좌측 4px 바만 다름, 라벨은 셋 다 회색).
    페이지에서 가장 중요한 정보인데 훑을 때 "혜택" 과 "손해" 가 구분되지 않았다. 되돌리지 말 것
  - **표면을 서로 다르게** — 정당색(파랑·빨강)을 못 쓰므로 색상환이 아니라 **온도·명도**로 가른다:
    | 카드 | 좌측 바 | 표면 | 라벨 칩 (외곽선) |
    |---|---|---|---|
    | `바뀌는 것` | `--ba-gold` | `#FBF5EA` 골드 tint (웜) | 골드 글자 + 골드 1px 보더 (대비 5.43) |
    | `혜택받는 사람` | `--ba-ink` | `#FFFFFF` 순백 (페이지 `#F7F6F1` 보다 밝아 도드라짐) | 차콜 (17.55) |
    | `손해보는 곳` | `--ba-meta` | `#F0F1F3` 쿨 그레이 (유일한 차가운 면) | 그레이 (4.56) |
  - 라벨은 **외곽선 칩**으로 승격 (mono **13px** / 700 / letter-spacing 0.14em / uppercase / radius 6 / `border: 1px solid currentColor`). 기존 mono 12px 회색 텍스트는 머리말이 아니라 메타데이터로 읽혔다
    - ⚠️ **더 키우려면 소카드 폭을 먼저 확인할 것.** 최장 라벨 `혜택받는 사람` 이 13px 에서 135px 인데 소카드 내부는 148px(1025px 이상) 이라 **여유가 13px 뿐**이다. 14px 로 올리면 2줄로 깨진다
  - **태블릿(769~1024px)은 2열로 전환** — `1fr 1fr` + `바뀌는 것` 전체폭.
    3열을 유지하면 소카드 내부가 121px 까지 좁아져 라벨 칩이 2줄로 깨지고 16px 본문이 한 줄에 7글자만 들어간다 (820px 실측). 2열이면 내부 314px 확보
    - 채움(흰 글자 + 색 배경)도 만들어 봤으나 **차콜 칩이 흰 카드 위에서 혼자 시선을 독점**하고 페이지 톤(베이지 + 골드 단색)에서 과하게 튀어 외곽선으로 정리했다. 표면 3색이 이미 구분을 하므로 칩까지 채울 필요가 없다
  - hover: `translateY(-2px)` + 그림자 + 보더를 카드 색으로
  - **진입 애니메이션**: IntersectionObserver 로 `.ba-cards` 에 `.is-in` → 3장이 0/0.09/0.18s 지연으로 fade+rise
    - ⚠️ **내용을 접지 않는다.** "가려두고 hover 로 펼치기" 안이 있었지만 채택하지 않았다 — 터치엔 hover 가 없어 모바일은 3번 탭해야 하고, Zone 3 아코디언을 이미 폐기한 판단과 모순되며, 못 읽고 지나가는 손실이 몰입 이득보다 크다
    - ⚠️ **숨김은 JS 가 `data-reveal` 을 붙일 때만 시작된다** — JS 실패 시 카드는 그냥 보인다
    - ⚠️ **2초 폴백 필수**: `is-in` 만 붙이는 건 "전환이 실제로 돌아야 보인다" 는 뜻이라, 백그라운드 탭 스로틀링·일부 웹뷰처럼 전환이 진행되지 않는 환경에서 `opacity:0` 인 채 영영 남는다. 2초 뒤에도 안 보이면 `data-reveal` 제거 + 인라인으로 전환을 꺼 강제 노출한다
    - `prefers-reduced-motion: reduce` 면 `data-reveal` 을 아예 안 붙임
  - 이모지 전체 제거
- **Zone 3 — 분석** (`#ba-analysis`, 토글 폐기):
  - 항목별 `<article>` = H3(세리프 24px) + 본문 (펼침 기본)
  - 라벨(`찬성 논리`/`반대 우려`/`법안 빈틈`)은 카드 좌측 외부 **마진노트 위치의 외곽선 칩** — Zone 2 라벨 칩과 **완전히 같은 스타일** (mono 13px/600, padding 5px 11px, radius 6, `border: 1px solid currentColor`, `--ba-meta`). 실측 101×33
    - 2026-08-11: mono 12px 회색 평문 → 13px 칩. 같은 역할의 라벨이 두 구역에서 다르게 처리돼 있었다
    - 위치 계산은 `right: calc(100% + 24px)` — 구 `left: -180px; width: 160px; text-align: right` 는 고정폭이라 칩 테두리가 거터 전체를 감싼다. 칩은 내용에 맞춰 줄어들어야 한다
    - 라벨이 `ISSUE_LABEL` (interactions.js) 의 **고정 3종이고 전부 4글자**라 칩 폭이 101px 로 균일하게 떨어진다 — 마진에서 들쭉날쭉하지 않는 근거
    - ⚠️ `top: 28px` 필수 (첫 항목만 `top: 0`). `.ba-issue` 가 `padding: 28px 0` 이라 `top: 0` 이면 칩이 제목보다 28px 위에 떠 **앞 섹션에 붙은 것처럼 보인다.** 평문일 땐 안 띄었지만 박스가 되니 드러났다
    - ⚠️ **세 라벨의 색은 반드시 같아야 한다** (`--ba-meta`). Zone 2 처럼 라벨별로 색을 주면 안 된다 — `바뀌는 것/혜택/손해` 는 서술이지만 `찬성/반대` 는 **입장**이라, 색을 다르게 주는 순간 어느 쪽을 지지한다는 신호가 된다. 정치색 배제 원칙의 핵심
  - 색상 배지·아코디언·"여기까지 70%" 프로그레스 모두 제거
  - 1240px 미만에서 마진노트 인라인으로 폴백
- **Zone 4 — 페이지 레벨 sticky 인덱스** (`.pb-section-index`, 2026-04-27 페이지 레벨):
  - `position: fixed; top: var(--nav-h) + 32px; left: calc(50% + 448px); width: 180px` — 콘텐츠(`.ba-content` max 880 중앙정렬, 우측 끝 = `50% + 440`) 바깥에 항상 위치
  - ⚠️ **클램프(`min(..., calc(100% - 232px))`)를 되살리지 말 것** (2026-08-11 제거). 화면이 1424px 미만이면 클램프가 이겨서 인덱스가 안쪽으로 당겨졌고, 배경이 투명이라 **본문 글자와 겹치고** `z-index: 40` 때문에 발의자 `전체 보기 ▾` 토글이 **클릭 자체가 막혔다**. 1240~1355px 구간 — 1280px 는 가장 흔한 노트북 폭이다
    - 원칙: **겹치더라도 보여주기보다, 자리가 없으면 숨긴다.** 그 구간은 jumpbar 가 대체한다
    - 실측(1280px): 인덱스 1083~1263 / 콘텐츠 우측 1071 → 12px 여유, 화면 안에 들어옴
  - **두 그룹** — `AI 분석` (요약/핵심 변화/분석/함께 생각/원문 대조) + `참여` (국민 찬반/본회의 표결/의견) ※ 발의자는 Zone 1 헤더 스택으로 통합되어 인덱스 항목에서 제거
  - 그룹별 좌측 1px 가이드 라인 + 8px 도트 (외곽선 `#C8C0AA` → 활성 채움 `#8F5800` + 4px glow). 도트 안쪽 `--bg` 채움으로 라인이 점 뒤로 안 보이게
  - 그룹 라벨: mono 10px / letter-spacing 0.22em / `#746C5D` uppercase (구 `#A8A095` 는 대비 **2.39** 로 사실상 안 보였음 → 4.80)
  - 항목: 12px `#646E7E` / 7px 패딩 / 우측 카운트 (10px `#746C5D`). 180px 폭에서 최장 항목 `본회의 표결 294` 도 한 줄 유지
  - 데이터 카운트(찬반·의견) 페이지 로드 후 `PB.fetch` 로 동적 채움 (본회의 표결은 서버 SSR)
  - **스크롤 기반 활성 트리거** (IntersectionObserver 의 좁은 활성 띠로 짧은 마지막 섹션 못 잡는 문제 회피). DOM 순서대로 순회 → `top <= getScrollOffset()` 인 마지막 섹션 active. 페이지 끝 도달 시 마지막 섹션 강제 활성화
  - 클릭 스크롤 오프셋: `getScrollOffset()` = `--nav-h + 20` 동적 (데스크톱 120 / 모바일 80) — 5-Zone 헤드라인이 nav 뒤로 가리지 않게
  - `padding-left: 8px` — `overflow-y:auto` 가 x clip 하는 브라우저 동작 회피용 (도트 좌측 잘림 방지)
  - **1260px 미만 자동 숨김** → 모바일 floating jumpbar 로 대체. `left(50%+448) + width(180) ≤ 100%` 가 성립하는 최소 폭이 1256px 이라 1260 을 컷으로 잡음

- **모바일 floating jumpbar** (`.pb-mobile-jumpbar`):
  - `position: fixed; bottom: max(16px, env(safe-area-inset-bottom, 16px))` — iOS 홈 인디케이터 보호
  - <1260px 전체 노출 (Fold 펼친·작은 노트북·태블릿·모바일). ≥1260 데스크톱은 sticky 인덱스 사용
    - ⚠️ 이 breakpoint 는 `.pb-section-index` 숨김 breakpoint 와 **반드시 같은 값**이어야 한다. 어긋나면 둘 다 없는 구간(길 잃음)이나 둘 다 있는 구간(중복)이 생긴다
  - 4 핵심 탭 (요약·분석·찬반·의견) + 골드 ↑ 버튼. 탭 `min-height: 40px` / ↑ 버튼 40×40 — 바 높이 52 − padding 6×2 = 40 이 상한이라 44 는 불가
  - **항상 표시**, input/textarea 포커스 시에만 숨김 (`focusin`/`focusout` 위임 + focusout `setTimeout(0)` 으로 activeElement 재확인하여 입력 간 전환 깜빡임 방지)
  - JS 가 페이지 로드 후 `document.body.appendChild(jumpbar)` 로 이동 — `.pb-main { position:relative; z-index:1 }` 의 stacking context 를 탈출해야 footer (z-index 1) 위로 정상 노출
  - `.bd-wrap { padding-bottom: 84px }` 같은 범위에 적용 (jumpbar 가 콘텐츠 가리지 않게)
- **Zone 5 — 질문** (`#ba-questions`, 옛 Zone 4):
  - 골드톤 박스 제거 → 단일 컬럼 본문에 통합
  - 번호 배지: 28px 원형, **외곽선만** (1.5px solid `--ba-gold`), mono 12px 700
  - 질문 본문 세리프 18px / 700 + 보조 라벨(`q.hint`) mono 12px `--ba-meta`
  - CTA `<button>` 차콜 배경 → 골드 hover (이전 골드 → 차콜 hover 반대)
- **국회 원문 링크**: Zone 1 태그라인 아래 텍스트 링크로
- **XSS 방어**: `JSON.stringify(analysis).replace(/</g, '\\u003c')` + `renderRichText()` 헬퍼로 `<strong>` 만 허용하는 선별 이스케이프

### `/bill/:id` 참여 섹션 디자인 통합 (Zone 7~11, 2026-04-27)
5-Zone 토큰을 그대로 이어받아 참여 섹션도 같은 시스템.

- **Zone 7 — 챕터 디바이더** (`.ba-chapter`): 분석 끝 ↔ 참여 시작 사이 풀폭 브레이크. 상단 1px 보더 + 메인 헤딩 세리프 900 / 36px "이제 당신이 답할 차례입니다" + 서브 15px `#6B7280` "법안에 찬반을 표시하고, 다른 국민들의 의견을 읽어보세요"
- **Zone 8 — 국민 찬반** (`#citizen-vote-section .pb-part`): cv-bar 12px / 차콜+골드. CTA 두 버튼 동일 무게 흰 배경. 위치(좌/우) 로만 입장 구분 — 이모지 제거
- **Zone 9 — 본회의 표결** (`#part-floor-vote`): 데이터 없을 때 italic `#9B9486` empty state. 있을 때 4-박스 vote-dashboard 톤만 통일 (정당색은 객관 데이터라 그대로). **2026-08-16 비중 추가** — 찬성·반대·기권은 **참여분**(찬+반+기권), 불참은 **전체** 기준 (의원 상세 `.vote-tally` 와 같은 규칙, 각주에 두 분모를 숫자로 씀). 국민 찬반(`PB.mountCitizenVote`) 범례에도 % (총 0명이면 안 씀)
- ~~**Zone 10 — 발의자**~~: **2026-04-27 폐기** — 발의자는 메타데이터의 일부라 Zone 1 헤더 컴팩트 스택으로 통합됨. 참여 영역에서 분리
- **Zone 11 — 댓글** (`#part-comments`): 정렬 토글 알약 → 텍스트 underline. 카드 흰 배경 / `#E8E5DC` / radius 10. 닉네임 700, 본문 14/1.7. 좋아요 활성 골드

### `/bill/:id` 처리 경과 타임라인 (2026-08-11)
`#bill-timeline` — 파샬 `views/bill/_bill_timeline.ejs`, **두 분기 공통**. 소스는 `bills` 의 처리 단계 날짜 9종.
이전엔 이 법안이 어디까지 왔는지를 `계류` / `원안가결` 단어 하나로만 알 수 있었다.

**위치는 헤더/Zone 1 바로 아래다** (처음엔 챕터 디바이더 앞이었으나 이동):
- 법안의 **76%가 계류**(14,130/18,671)라 "어디까지 왔나" 가 사실상 유일한 실질 정보다
- 헤더 메타의 `결과` 한 단어를 **경로로 확장**하는 역할이라, 붙어 있어야 중복이 아니게 된다
- 본문을 읽을지 정하는 재료라 읽고 난 뒤에 보여주면 늦다
- (본회의 표결 섹션 옆이 주제상 가깝지만 표결 있는 법안은 602건(3%)뿐이라 97%에겐 성립 안 함)

| 분기 | SSR 위치 | 최종 위치 |
|---|---|---|
| 미분석 | `bill-basic-header` 다음 | 그대로 (JS 불필요, 레이아웃 시프트 없음) |
| 분석 있음 | `#bill-analysis` 다음 | **JS 가 `.ba-z1` 뒤로 이동** |

- ⚠️ Zone 1~5 는 `PB.mountBillAnalysis` 가 렌더해서 EJS 가 Zone 1↔2 사이에 끼어들 수 없다. mount 직후 `insertAdjacentElement('afterend')` 로 옮긴다 (모바일 jumpbar 이동과 같은 수법). JS 실패 시 SSR 위치에 남아 정보는 유지된다
- **컴팩트 한 줄 흐름** — 히어로 근처라 카드 배경·결과 칩·"상정" 보조줄을 뺐다. 실측 높이 61px(1280) / 114px(375). 결과는 **마지막 완료 단계에만** 붙인다 (중간 결과까지 넣으면 한 줄이 무너진다)
- 상태 3종: `done`(골드 채운 점 + 날짜) / `pending`(빈 점, 흐린 라벨) / `skipped`(점선 점 + **취소선**)
  - ⚠️ **"미도달" 과 "거치지 않음" 을 반드시 구분할 것.** 뒤 단계에 날짜가 있는데 앞이 비었으면 그 단계를 안 거친 것이다 (대안반영폐기는 법사위를 건너뛴다 — 법사위 통과는 601건뿐). 둘을 같게 그리면 데이터가 빠진 것처럼 보인다
  - 컴팩트에선 점 모양만으로는 안 갈려서 skipped 에 취소선을 준다. 상태는 `.pb-sr-only` 로 텍스트도 제공 (`title` 은 스크린리더가 일관되게 안 읽는다)
- ⚠️ **마지막 단계 라벨을 "본회의" 로 고정하면 안 된다.** API 의 `PROC_DT`/`PROC_RESULT` 는 "최종 처리" 지 본회의 의결이 아니다. **철회(161건)는 발의자가 거두는 것**이라 본회의를 안 거치는데 "본회의 / 철회" 로 나왔다. `FLOOR_RESULTS` 에 없으면 결과명을 라벨로 쓰고 결과는 중복이라 뺀다
- 정당색 배제: 상태 구분은 **골드(완료) / 회색(미도달) / 점선+취소선(거치지 않음)** 으로만. 가결·부결에 색을 주지 않고 결과는 텍스트로만
- **레이아웃 내구성** (스트레스 테스트 완료):
  - 단계 수는 코드에 **5개 고정** — 늘거나 줄지 않는다. 그래도 `flex-wrap` 이라 3~9단계를 넣어도 줄바꿈으로 흡수된다(실측)
  - ⚠️ **가변 요소는 단계 수가 아니라 마지막 라벨/결과 문자열이다.** `proc_result_name`(varchar 50)이 그대로 들어온다. 현행 값은 최장 7자(`수정안반영폐기`)지만 API 가 긴 값을 주면 `word-break: keep-all` 때문에 한 덩어리가 되어 **페이지가 가로로 밀렸다** (50자 주입 시 103px 오버플로 실측)
  - → `.tl-label` / `.tl-result` 에 `overflow-wrap: anywhere` + `min-width: 0` (`.tl-step` 에도). 다른 줄바꿈 기회가 없을 때만 강제로 쪼개므로 평소 한글 가독성은 그대로다. 적용 후 **영문 200자를 넣어도 가로 오버플로 0**, 세로로만 늘어난다 (320px 포함)
- sticky 인덱스에 `경과 > 처리 경과` 그룹 추가. ⚠️ 인덱스 순서는 **DOM 순서와 일치**해야 스크롤 활성 추적이 안 어긋난다
- 날짜는 `getDetail.sql` 에서 `TO_CHAR(..., 'YYYY-MM-DD')` 로 문자열화해 넘긴다 — DATE 를 JS Date 로 받으면 타임존 해석이 끼어 하루 밀린다

### `/bill/:id` 법안 원문 섹션 (2026-08-11)
`#bill-summary-raw` — **두 분기 모두** 노출되지만 역할과 형태가 다르다.

| | 미분석 법안 | AI 분석 있는 법안 (`.is-compare`) |
|---|---|---|
| 위치 | `bill-basic-header` 아래, 분석 요청 위젯 **위** | 5-Zone 아래, 챕터 디바이더 **앞** |
| 역할 | **본문** (유일한 내용) | **검증** (원문 대조) |
| 제목 | `제안이유 및 주요내용` | `국회 원문과 대조하기` + 설명 한 줄 |
| 접힘 | 700자 초과 시만 · 15em 엿보기 + 페이드 | **항상 · 완전 접힘(`display:none`) accordion** |
| 버튼 | `전문 보기 ▾` | `원문 펼치기 ▾` |
| 배경 | `#FAFAF7` 카드 | 투명 + dashed 보더 (참고자료 신호) |

- 버튼 라벨은 `data-label-collapsed` / `data-label-expanded` 로 마크업이 정한다 (JS 는 읽기만)
- ⚠️ **대조 모드에서 "15em 엿보기" 를 쓰면 안 된다** — 원문 중앙값이 498자라 대부분 15em 보다 짧아서 접힘 높이 == 전체 높이가 되고, 버튼을 눌러도 아무 일도 안 일어나는 것처럼 보인다 (실제로 그렇게 만들었다가 고쳤다)
- ⚠️ **이건 AI 가 읽은 그 문서가 아니다.** AI 분석은 `pal.assembly.go.kr` 입법예고 페이지를 크롤하고(`syncBillAiAnalysis.js:56`), 이 원문은 열린국회 API `BPMBILLSUMMARY` 다. 둘 다 국회가 낸 "제안이유 및 주요내용" 이지만 동일 문서 보장은 없으므로 **"AI 가 읽은 원문" 같은 표현을 쓰지 말 것**. 대조용 참고자료로만 제시한다
- 왜 분석 있는 법안에도 넣었나: 상단에 `AI가 생성한 분석으로 사실과 다를 수 있습니다` 라고 써놓고 정작 대조할 원문은 사이트를 나가야 볼 수 있었다. 접혀 있으면 안 펼치는 사람에겐 비용 0, 의심하는 사람에겐 가치가 크다
- `.is-compare` 는 `max-width: 880px` 로 `.ba-content` 와 좌우를 맞춘다 (`bd-wrap` 960px 그대로면 어긋나 보인다)
- 모바일 jumpbar 에는 **추가하지 않는다** — 4탭(요약·분석·찬반·의견) 유지. 원문 대조는 부차 동작이라 sticky 인덱스에만 둔다

공통 규칙:
- 미분석 분기는 **원문이 분석 요청 위젯보다 위**에 온다 — 내용을 읽고 나서 요청을 누르는 순서라야 한다
- 소스는 `bills.summary` (국회 공식 제안이유·주요내용). `getDetail.sql` 은 목록과 달리 **절단하지 않는다** — 상세는 전문을 보는 자리
- 반드시 `stripSummaryHeading()` 을 거친다 (원문 99.8%가 `제안이유 및 주요내용` 줄로 시작하고, 그건 이미 섹션 제목이 하고 있음)
- 본문 `white-space: pre-line` — 원문 문단 구분을 살리고 들여쓰기 잡음은 접는다
- 접기는 어느 분기든 필수다. 실측 최장 10,349자는 펼침 5,386px — 안 접으면 페이지가 못 쓰게 된다
  - 접을 때 섹션 상단으로 smooth scroll 복귀 (안 하면 사라진 본문 아래 허공에 남음)
  - `rawSummary` 계산은 `if (analysis)` **바깥**에 있어야 한다 — 두 분기와 헤더 조건문이 모두 이 값을 쓴다
- **`.raw-src` "국회 의안정보 원문 ↗" 필수** — 바로 위에 `🤖 AI 분석 / 아직 분석되지 않은 법안입니다` 라벨이 떠 있어서, 출처를 안 박으면 이 본문이 AI 생성물로 읽힌다
  - **출처 표기 + 국회 원문 링크를 겸한다** (2026-08-11). 헤더 `.zone-1-top` 의 `국회 원문 ↗` 버튼과 같은 `bill.link_url` 이라 중복이었다
  - 색은 **골드 `#8F5800` + 상시 밑줄 + weight 500** (hover `#6B4200`). 회색 메타 톤으로 두면 클릭 가능한 줄 모른다 — 이 사이트의 링크 색은 골드다
    - ⚠️ **파란 링크로 만들지 말 것** — 정당색(파랑·빨강) 금지는 중립성 브랜드의 핵심 원칙이다. "링크처럼 안 보인다" 의 해법은 파랑이 아니라 골드
    - 대비비 5.64:1 (배경 `#FAFAF7`) — 11px 소형 텍스트라 WCAG AA(4.5:1) 충족이 필요했다
    - `link_url` 이 없을 때의 `<span>` 폴백은 **회색 유지** (클릭 불가인데 골드면 링크로 오인). 현재 해당 0건이지만 방어용
  - 분기: **원문 있음(18,631건) → 헤더 버튼 제거**, `.raw-src` 가 링크 / **원문 없음(40건) → 헤더 버튼 유지** (국회로 가는 유일한 통로가 사라지면 안 됨)
  - 그래서 `rawSummary` 계산은 `bill-basic-header` **위**에 있어야 한다 (헤더의 조건문이 이 값을 쓴다)
  - AI 분석 분기(5-Zone)의 `.ba-original-link` 는 별개 경로(`interactions.js`)이고 원문 섹션이 없어 중복이 아니므로 그대로 둔다
- 5-Zone 의 `--ba-*` 토큰은 `.bill-ai-analysis` 스코프라 여기선 못 쓴다 → `--raw-ink/meta/gold` 로 같은 값을 다시 선언
- sticky 인덱스·모바일 jumpbar 에 `법안 내용 > 제안이유` 항목 추가 (분석 없고 `bill.summary` 있을 때만)
- 원문이 없는 40건(대안반영폐기·철회)은 섹션 자체가 렌더되지 않음

> ⚠️ **원문 530건(2.8%)에 전각 물음표 `？` 가 섞여 있다.** 열린국회 API 가 가운뎃점(`ㆍ`)을 변환하지 못한 것으로 보인다
> (`민？형사상`, `지도？감독`). 같은 문서 안에 정상 `ㆍ` 와 공존한다. **일괄 치환은 하지 않았다** — `선거제도는？비례대표`
> 처럼 가운뎃점이 아닌 자리도 섞여 있어 오변환 위험이 있다. 원문 그대로 두는 게 출처 표기와도 맞다.

### `/bill/:id` 분석 요청 위젯 (2026-04-25)
미분석 법안에서만 노출. **법안 원문 섹션** 바로 아래 골드 그라디언트 카드.
- 큰 숫자 카운터(세리프 32px) `<count> / <threshold>명` + 진행 바 (`linear-gradient(90deg, var(--accent), #D4A442)`)
- 임계값(`requestThreshold`, 기본 5명) 도달 시 "🎉 충분한 요청이 모였어요. 곧 분석됩니다." 초록 박스
- 비로그인: "로그인하고 분석 요청하기" → `/auth/login?next=<currentUrl>`
- 로그인 + 미요청: "💡 이 법안 분석 요청하기" → `POST /bill/:id/request-analysis` AJAX
- 로그인 + 이미 요청: "✓ 요청했어요" 비활성 버튼
- AJAX 성공 시 카운트·진행 바 즉시 갱신 + 버튼 교체 (페이지 새로고침 없이)
- `data-bill-id` / `data-count` / `data-threshold` / `data-has-requested` / `data-logged-in` 속성에 서버 상태 박아둠
- `PB.mountAnalysisRequest({ containerId: 'analysis-request-widget' })` 헬퍼가 처리

### `/bill/:id` 본회의 표결 명단 모달 (2026-04-24)
4개 박스(찬성/반대/기권/불참) 클릭 시 모달로 전체 명단 표시 — 상세 페이지 스크롤 부담 제거.
- 박스: `<button data-bucket>` · 0표는 `data-empty` 로 클릭 비활성
- 모달 구성: 버킷 라벨 + 정당별 필터 칩(카운트, 인원 많은 순) + 이름 검색(초성 지원) + 5열 × 8줄 고정 그리드 `height: 456px`
- chip: 발의자 섹션의 `.proposer-chip` 재사용 + 정당별 배경 tint(`cp-minjoo / cp-gukhim / cp-jokuk / cp-gaehyuk / cp-jinbo / cp-etc`, bg 0.08 alpha)
- 퇴임 의원: 필터 `퇴임 N명` 칩으로 집계, 개별 chip 은 `.retired` 클릭 불가
- 데이터 주입: `window.__BILL_VOTERS__ = { agree[], disagree[], abstain[], absent[] }` — `{mona_cd, name, party, photo}` 만 직렬화
- 닫기: backdrop / × / ESC, 열릴 때 `body` 스크롤 잠금

### `/xray` 구조 — 아코디언 + 섹션 지연 로딩 (2026-08-10 재편)
섹션이 계속 늘어나는 페이지라 **추가 비용이 일정하도록** 구조를 잡았다.

```
services/xraySections.js   ← 그룹(XRAY_GROUPS) + 섹션(SECTIONS) 정의 단일 소스
services/XrayService.js    ← SECTION_LOADERS[loader] : 그 섹션 쿼리만 실행 + 메모리 캐시
views/xray/xray.ejs        ← 그룹별 카드 그리드 + 펼침 JS (DB 조회 0회)
views/xray/sections/*.ejs  ← 섹션 본문 11개 (제목·설명은 목록이 담당하므로 body 만)
```

- **섹션 추가** = `SECTIONS` 에 한 줄 (+ `group` 지정) + partial 하나 + 로더 하나
- 🔴 **섹션을 목록에서 감추는 장치를 두지 않는다** (2026-08-16에 `hidden` 플래그를 넣었다 뺐다).
  데이터가 아직 없는 지표(`gap` — 국민 찬반은 이용자 참여로만 쌓인다)를 숨겼더니,
  **데이터가 생겨도 누군가 기억해서 수동으로 풀어야** 하는 상태가 됐다. 그건 잊힌다 —
  조용히 없는 기능이 되는 쪽이 빈 카드보다 나쁘다.
  → 빈 지표는 감추지 말고 **빈 상태 문구(`.xr-empty.is-guide`)로** 푼다:
  ① 왜 비었는지 ② 무엇이 있어야 채워지는지 ③ 지금 할 수 있는 행동(CTA)
- 🔴 **kicker(제목 앞 작은 분류 라벨)는 2026-08-15 제거.** 제목 앞 요약이 시선을 나눠서,
  **제목이 혼자 무슨 차트인지 말하게** 했다. 되살리지 말 것
  - ⚠️ 제목은 3열 그리드에서 **한 줄**에 들어가야 한다 (16자 내외). 길면 카드가 2줄로 커진다
  - ⚠️ **제목에 숫자를 박지 말 것** — 데이터가 쌓이면 조용히 거짓이 된다 (결론 숫자는 본문 큰 숫자가 맡는다)
- **그룹 추가** = `XRAY_GROUPS` 에 한 줄
- 둘 다 `xray.ejs` 는 안 건드린다
- 번호(`no`)는 **그룹 순서 → 그룹 내 순서**로 자동 부여. 어디에 끼워넣어도 손댈 곳이 없다
  (이전엔 gapdist 를 3번에 넣느라 기존 03~10 을 04~11 로 전부 밀어야 했다)
- `group` 오타로 어느 그룹에도 안 걸리면 **"기타" 그룹으로 노출 + 경고 로그**. 조용히 사라지지 않는다

**그룹 5종 · 섹션 13개**: 표결(합의분포·당론이탈·불참률) /
발의(발의vs가결·초당협력·발의스타일) / 법안(생존율·**월별추이**·AI카테고리) /
성향(당성향격차·**찬성률수준**·성향스펙트럼) / 국민(국민vs국회 — 참여가 쌓이면 채워짐)

> **`gapdist`(격차) 와 `ratedist`(수준) 는 역할이 다르다** (2026-08-15).
> 전자는 자당률−타당률 **차이**의 분포, 후자는 그 **두 값 자체**의 분포다.
> 격차 2%p 가 `99→97` 인지 `70→68` 인지는 격차만 봐선 알 수 없다.
> ⚠️ 단 **정보가 상당히 겹친다** — 자당률이 사실상 상수(sd 0.92)라 `격차 ≈ 100 − 타당률` 이고
> **격차와 타당률의 상관이 −0.989** 다. `ratedist` 가 새로 더하는 건 "수준" 하나뿐이니
> 둘을 합칠 생각이 들면 이 수치를 먼저 볼 것.

> ⚠️ **월별 추이(`monthly`) 는 처리 지연을 반드시 같이 보여줄 것.**
> 최근 달일수록 처리 완료가 0 에 수렴한다 (실측: 2026-05 발의 254건 중 처리 1건, 최근 6개월 3.3%).
> "가결률"만 그리면 국회가 갈수록 일을 안 하는 것처럼 보이지만 **아직 심사 중일 뿐**이다.
> 진행 중인 달(`isPartial`)은 막대를 흐리게 + 꺾은선·평균 통계에서 제외한다.

> 🔴 **모바일 차트 글자 크기 — `.xr-svg-box` 가 가로 스크롤한다** (2026-08-15).
> 전 차트가 `viewBox` 1000 유저단위에 `font-size` 10~13 을 쓰는데, 모바일 표시폭이 259px 이면
> **0.26 배로 눌려 글자가 2.6~2.8px** 이 된다. SVG 6개 전부 같은 증상이었고 **아무것도 안 읽혔다.**
> → ≤768px 에서 `overflow-x: auto` + `svg { min-width: 860px }`. 실측 **9.5~11.2px** 로 복구.
> - ⚠️ 860px 은 "font-size 11 → 화면 9.5px" 이 되는 하한이다. 더 줄이면 다시 안 읽힌다
> - ⚠️ `.xr-svg-hint`("← 옆으로 밀어서") 를 같이 둘 것 — 안 알리면 오른쪽 절반이 없는 줄 안다
> - ⚠️ 문서 가로 스크롤은 안 생긴다 (박스 내부 스크롤). `.status-tabs-inner` 와 같은 수법
> - 근본 해결은 차트를 세로형으로 다시 그리는 것이지만 그건 섹션별 재설계다

> **섹션마다 결론을 먼저 준다** (2026-08-15). 순위표·산점도만 두면 "그래서 뭐?" 로 끝난다 —
> `dissent`·`absent`·`propose`·`leader`·`category` 에 **한 줄 결론 + 큰 숫자**를 목록 위에 얹었다.
> - ⚠️ 결론 문구를 **데이터 확인 전에 쓰지 말 것.** 불참률을 "대부분은 잘 나온다" 로 쓸 뻔했는데
>   실측 중앙값이 **20.7%**(다섯 번 중 한 번은 빠진다)라 정반대였다
> - ⚠️ `propose`·`leader` 는 **모양이 똑같은 산점도**다. 축이 다르다는 걸(`발의×가결률` vs
>   `공동발의×대표발의`) 문장으로 먼저 말해야 구분된다
> - `propose`·`leader`·`category` 의 결론 숫자는 **이미 받은 배열에서 계산**한다 (추가 쿼리 0)

**레이아웃** — 접힌 카드는 그리드, 펼친 카드만 전체폭:
- `.xr-grid` 3열 (≤1100px 2열 / ≤768px 1열), 펼치면 `grid-column: 1 / -1`
- 차트가 1000px 폭 SVG 라 열릴 땐 전체폭이 필수인데, 접힌 상태는 밀도가 중요해서 나눈 것
- 카드 제목은 **한 줄에 들어가게 짧게** 유지할 것 (길면 3열에서 2줄로 접혀 카드가 커짐).
  긴 설명은 `desc` 로 — 접힘 2행(모바일 1행) 클램프, 펼치면 전문
- 실측(1280px, 11개): 1열 1,053px → 3열+그룹 **901px**. 모바일 1,324px

- **왜 바꿨나**: 이전엔 14개 쿼리를 `Promise.all` 로 전부 돌린 뒤 렌더해서 **TTFB 2.3초 / HTML 248KB**.
  화면에서 접기만 해서는 서버가 여전히 14개를 다 돌기 때문에 데이터도 같이 지연 로딩해야 했다
- 결과: **TTFB 0.02초 / 39KB**, 초기 쿼리 **14 → 0**
- 캐시: 섹션별 10분 TTL 메모리 캐시 + inflight 공유(동시 요청 시 쿼리 중복 방지). 배치가 하루 1회만 바꾸는 값이라 안전.
  재요청 실측 1.6초 → 3ms
- 조각은 `layout: false` 로 렌더 — layout 을 타면 nav·footer 가 통째로 딸려온다
- ⚠️ **`innerHTML` 로 넣은 `<script>` 는 실행되지 않는다.** 스펙트럼 섹션이 축 전환 로직을 인라인 script 로
  갖고 있어서, `xray.ejs` 의 `runScripts()` 가 조각 삽입 후 script 태그를 재생성해 실행시킨다.
  섹션에 script 를 넣을 땐 이 경로를 탄다는 걸 전제할 것
- 접으면 DOM 은 남기고 `hidden` 만 토글 — 다시 펼칠 때 재요청 없음
- **기본은 전부 접힘** — 자동 펼침을 두지 않으므로 진입 시 DB 조회가 정말로 0회
- `/xray#xr-<id>` 로 진입하면 그 섹션만 자동 펼침 (링크 공유용)

### `/xray/chart` 커스텀 차트 빌더 (2026-08-11, Phase A)
`/xray` 한 메뉴 안에 **기본 지표(샘플, 손으로 고른 12개)** 와 **커스텀 차트** 두 영역을 둔다.
진입은 `/xray` 페이지 헤더 우측의 `직접 만들어보기` 카드.

```
services/chartRegistry.js  ← 축·지표·필터 화이트리스트 (단일 소스)
daos/ChartDao.js           ← 스펙 → 안전한 SQL 조립 + 실행
services/ChartService.js   ← 쿼리스트링 파싱·검증 + 각주 조립
controllers/ChartController.js
views/xray/chart.ejs
```

**데이터 소스 2종** — base 테이블이 다르면 조인 대상도 달라진다 (레지스트리의 `per[source]`):

| 소스 | base | 축 | 지표 |
|---|---|---|---|
| `bills` 법안 (18,692) | `FROM bills b` | 정당·위원회·처리결과·발의월·처리단계·AI주제·성별·선수 (8) | 건수·평균 공동발의자·가결률·**평균 처리 소요일**·계류 비율 (5) |
| `votes` 본회의 표결 (177,260) | `FROM bill_votes v` | + 표결월·표결결과·**의원** / − 처리단계 (10) | 건수·**찬성률·반대기권률·불참률** (4) |

- 조인 주체가 다르다: 법안 소스의 `p` 는 **대표발의자**, 표결 소스의 `p` 는 **표결한 의원**
- **평균 처리 소요일**은 2026-08-11 단계 날짜 저장으로 **새로 가능해진 지표** (전체 평균 228일)
- ⚠️ **찬성률·반대기권률의 분모에서 불참을 뺀다** (찬성·반대·기권만). 불참을 넣으면 "성향" 과 "출석" 이 섞여 출석률 낮은 쪽의 찬성률이 같이 깎인다 — 교차 표결 지표가 쓰는 기준과 동일
- ⚠️ 정당 폴백 라벨은 `'명부 없음'` 이다. `'기타/무소속'` 으로 두면 **실제 정당인 '무소속' 과 나란히 떠서 구분이 안 된다** (실측: 무소속 99.2% / 명부 없음 98.4%). `/bill?party=` 의 라벨과 다른 건 의도된 것
- ⚠️ **소스를 바꾸면 축·지표가 그 소스에 없을 수 있다** (법안→표결 전환 시 `평균 처리 소요일`). 에러가 아니라 그 소스의 기본값으로 폴백한다
- 🔴 **현재 소스는 폼 안에 `<input type="hidden" name="source">` 로 들고 다녀야 한다.**
  소스 탭을 `<button type="submit" name="source">` 로 만들었다가 버그를 냈다 —
  브라우저는 폼 제출 시 **클릭한 submit 버튼의 name/value 만** 보내므로,
  `차트 그리기` 나 select 자동 제출로는 `source` 가 통째로 빠져 서버가 기본값(법안)으로 폴백했다.
  **표결을 골라도 법안으로 되돌아가는 증상.**
  → 소스 전환은 **링크**(`<a href="?source=…">`)로 하고, 폼에는 hidden 하나만 둔다.
  (탭도 name="source" 로 두면 hidden 과 겹쳐 `source` 가 두 번 실린다)

**🔴 보안 — 이 원칙을 깨지 말 것:**
- 사용자가 보낸 문자열은 **SQL 에 닿지 않는다.** 축/지표/필터/정렬은 레지스트리의 **키로만** 지정되고 SQL 조각은 전부 코드 상수
- 필터 **값만** 파라미터 바인딩. 날짜는 `YYYY-MM-DD` 정규식까지 통과해야 함
- 모르는 키는 에러가 아니라 **기본값으로 조용히 폴백** (URL 을 손으로 고쳐도 안전하고, 링크가 깨져도 빈 화면보다 낫다)
- `ROW_LIMIT 60` + `statement_timeout 5초` (전용 커넥션에서 `SET LOCAL`)
- 실측 검증: 소스·축·지표·정렬·필터값·날짜에 SQL 주입 13종 시도 → 전부 기본값 폴백/바인딩 처리, DB 무결성 유지
- ⚠️ 레지스트리의 `sql` 문자열에 **변수를 템플릿 리터럴로 끼워넣지 말 것.** 이게 유일한 방어선이다

**중립성 장치 (사용자가 만든 차트가 그대로 공유되므로 필수):**
- 축·지표에 걸린 **해석 각주가 자동 부착**된다. 예: 정당 축 → "의석수가 다릅니다", 평균 처리일 → **"처리 완료 건만 — 계류 76% 제외, 생존 편향"**
- 표본 `n` 항상 표시, 5건 미만 그룹은 흐리게 + 경고 각주
- 정당별 색 구분 없음 — 전부 골드 단색 (도넛은 명도 계단)

**공유 (`차트 공유` 버튼):**
- 1순위 **`navigator.share()`** — 모바일에서 시스템 공유 시트가 뜨고, 거기에 **카카오톡·인스타그램 등 설치된 앱이 전부** 나온다. API 키 불필요
- 폴백(주로 데스크톱) — X·페이스북·라인 인텐트 URL + 링크 복사. 전부 키 없이 되는 것들
- ⚠️ **인스타그램은 웹에서 링크 공유 수단을 제공하지 않는다.** 스토리 공유(`instagram-stories://`)는 네이티브 앱 전용이고 이미지가 필요하다. 웹에서의 유일한 경로는 위 시스템 공유 시트다
- ⚠️ **카카오톡 웹 공유(리치 카드)는 Kakao JS SDK + JavaScript 키가 있어야 한다** — 현재 미설정. OAuth 용 `KAKAO_CLIENT_ID`(REST 키)와 **다른 키**이고 도메인 등록도 필요하다
- 링크 미리보기를 위해 **페이지가 `ogTitle`/`ogDesc`/`ogPath` 를 넘긴다** (2026-08-11 `layout.ejs` 에 오버라이드 지원 추가). 안 넘기면 브랜드 기본값이라 무슨 차트인지 안 보인다

**필터 UI:**
- 정당·위원회 다중 선택에 **`전체` 항목(value="")** 이 첫 줄에 있다. 아무것도 안 고른 상태가 곧 전체지만 그건 암묵적이라 사용자가 알 수 없다. 빈 값이라 서버에서 자연히 걸러진다
- ⚠️ `전체` ↔ 개별 상호배타는 **이전 선택과 diff 로 판정**한다. `change` 이벤트만으로는 "방금 무엇을 눌렀는지" 알 수 없다 (`document.activeElement` 로 판별하려다 틀렸다)
- ⚠️ 전체를 뺄 때는 **`all.selected = false` 만** 한다. 개별 옵션을 전부 `selected` 로 만들면 사용자가 고른 것과 무관해진다 (실제로 그 버그를 냈다)
- ⚠️ 라벨(`.ch-label`)에 **mono 폰트 + 넓은 자간을 쓰지 말 것.** JetBrains Mono 는 한글 글리프가 없어 폴백되고 `letter-spacing: 0.18em` 까지 겹치면 "정당"·"위원회" 가 흩어져 거의 안 읽힌다. 본문 산세리프 12.5px/700 으로 (대비 7.74)

- **URL 이 곧 저장이다.** 스펙이 쿼리스트링에 담겨 링크 복사만으로 공유된다 → Phase A 는 저장 테이블 0개.
  Phase B(갤러리)는 이 URL 을 저장하는 것뿐이고, 샘플 차트를 시드해 콜드 스타트를 막는다
- GET 폼이라 **JS 없이도 동작**한다 (select change 자동 제출은 향상일 뿐)

### `/briefing` AI 카드 피드 (2026-08-11)
원래 구상은 **"AI가 정리한 카드가 피드처럼 쌓이고, 댓글 달고 외부 공유"** 였다.
1단계에서 만든 주간 데이터 대시보드는 **상단 요약 스트립으로 축소**하고 피드를 본체로 삼았다.

```
batch/genBriefing.js       ← 하루 1콜. 그날 법안 전건 → Haiku → briefing_posts UPSERT
ddl/migrations/2026-08-11-briefing-posts.sql
ddl/migrations/2026-08-11-briefing-threads.sql   ← threads 컬럼 (v2)
views/briefing/feed.ejs    ← 카드 목록
views/briefing/post.ejs    ← 카드 상세 (주제 묶음·댓글·공유·뉴스 링크)
views/briefing/card.ejs    ← 인스타 카드 (1080×1350 캐러셀)
```

#### 인스타 카드 `/briefing/:id/card` (2026-08-14)
브리핑을 **인스타 캐러셀 이미지로 뽑는 자리**. 홍보용 콘텐츠를 따로 만들지 않기 위한 것 —
인스타 계정이 죽는 1순위 원인이 "올릴 게 떨어져서" 인데, 이 파이프라인은 국회가 여는 한 고갈되지 않는다.

- 슬라이드: `표지 → 숫자 → 흐름 ×N → 몰린 법률 → 마무리`. **개수는 데이터가 정한다** (실측 5~7장).
  주제 묶음은 `MAX_THREAD_SLIDES = 3` 까지만 — 캐러셀이 길면 끝까지 안 넘긴다
- 🔴 **2번 「그날의 숫자」 는 표지 숫자의 반복이 아니라 비교다** (2026-08-16 피드백: "2번에서 새로 얻는 게 없다 — 캐러셀은 2번째 이탈이 가장 크다").
  표지의 29/20/341 은 그대로 두고(AI 문장 아래 SQL 근거 배치), 2번은 `발의 N건 → 최근 30 평일 평균의 M배 · 그중 K번째` ·
  `법안 1건당 공동발의 명` · `대표발의 의원 1명당 건` (+ 본회의 처리). 기준선은 **렌더 시 SQL** (`getCardBaseline.sql`,
  `BriefingService.getCardContext`) — 저장하지 않고, AI 에게서 받지 않는다
  - 🔴 **첫 줄(발의)은 조건부다** — `평균의 1.0배 · 14번째로 많은 날` 은 정보량 0 이라 첫 지표부터 김이 빠진다 (2차 피드백).
    배수는 **1.3배 이상 / 0.7배 이하**일 때만, 순위는 **상위·하위 5위 안**일 때만. 평범한 날은 `이번 주 누적 N건 (M일째)`(2일 이상 쌓였을 때),
    그것도 없으면 `평균 N건과 비슷한 수준`. 실측: 08-14 `이번 주 누적 99건 (5일째)` · 08-13 `평균 28.7건의 0.7배 · 4번째로 적은 날`
  - ⚠️ 기준 구간은 **카드 날짜 −3일 이전 30 평일** — 원천이 1~2일 늦어 최근 며칠은 0 으로 잡혀 평균을 끌어내린다. 주말 제외(항상 0건)
  - ⚠️ 기준선 없음(조회 실패·`base_days < 10`)이면 **그 장을 뺀다** — 표지와 겹치는 장을 내보내느니 6장이 낫다
  - ⚠️ 구 `위원회별 발의` 줄은 뺐다 — 갓 발의된 법안은 회부 전이라 committee 가 NULL 이고, 그 줄은 사실상 나온 적이 없다
- **흐름 장은 위에 붙인다** (`.sl-body.is-top`) — 가운데 정렬(`safe center`)이면 내용이 600px 남짓이라 위 40% 가 빈다.
  법안 목록 5건(`THREAD_BILLS`)·36px·간격 30. `safe center` 는 넘칠 때 어차피 flex-start 라 넘침 방어 세 줄과 충돌 없음
- **몰린 법률 장은 설명이 위, 법률마다 대표발의자**(`getCardLawProposers.sql`, 이름만·정당 없음) — "2건 × 3줄" 만으론
  왜 주목할 일인지가 없다. 이야기는 **같은 법을 두고 서로 다른 의원이 각자 안을 냈다**는 것. 이름 중복 제거
- 두 모드가 **같은 `.sl` 마크업**을 쓴다. 다르면 "미리보기는 멀쩡한데 올린 게 깨지는" 상황이 생긴다
  | | |
  |---|---|
  | (쿼리 없음) | 전체를 0.35 배로 배열 + 툴바 (사람이 훑는 용도) |
  | `?slide=N` | 그 장만. `html`·`body` 가 정확히 1080×1350 → **자동화가 그대로 돌면 된다** |
- 범위 밖 `?slide` 는 에러가 아니라 접는다 (`99`→마지막 / `0`·`abc`·`-3`→1). 실측 검증
- 🔴 **`.sl-body` 의 세 줄은 세트다. 하나만 빠져도 긴 콘텐츠에서 조용히 깨진다:**
  ① `justify-content: safe center` — 그냥 `center` 면 넘칠 때 **위아래로 동시에** 삐져나가 제목이 잘린다.
     `safe` 는 넘치는 순간 flex-start 로 떨어져 머리부터 보이게 한다
  ② `overflow: hidden` — 넘친 꼬리가 하단 브랜드 줄을 덮는 걸 막는다
  ③ `.sl-body > * { flex: 0 0 auto }` — 기본값(`shrink:1`)이면 목록이 찌그러져 **넘침이 측정에 안 잡힌다.**
     실제로 스트레스 테스트가 `over: 0` 을 돌려줘 한 번 놓쳤다
- ⚠️ **넘침 측정에 `scrollHeight` 를 쓰지 말 것.** 가운데 정렬 flex 는 위로도 넘치는데 `scrollHeight` 는 그걸 못 센다.
  자식들의 `offsetHeight` 합으로 재야 한다 (`getBoundingClientRect` 는 미리보기의 0.35 배 transform 이 섞인다)
- ⚠️ 헤드라인 크기는 **서버가 글자 수로 정한다.** JS 로 줄이면 폰트 로드 전에 캡처될 때 크기가 달라진다
- **날짜는 표지에서 메타가 아니라 정체다** (일간 기록물이라 날짜가 곧 제목의 일부) — 표지만 54px `--ink` + 요일,
  나머지 장은 34px `--sub` 워터마크. 같은 크기로 두면 5장 내내 시끄럽다
  - ⚠️ 요일은 `new Date('YYYY-MM-DD').getDay()` 로 구하지 말 것 — 실행 환경 타임존을 탄다.
    `Date.UTC(y, m-1, d)` + `getUTCDay()` 로 고정한다 (프로젝트의 "로컬 getter 금지" 규칙)
  - ⚠️ `(수)` 는 `.sl-date` 의 mono 를 물려받아 폴백된다 → `.sl-dow` 에 산세리프를 다시 지정
  - ⚠️ **모든 장에 날짜가 있어야 한다.** 흐름 장에만 빠져 있었는데, 캐러셀에서 한 장만 캡처돼
    돌아다니면 언제 건지 알 수 없다. 실측: 전 카드 `undatedSlides: 0`, 헤더 최소 여유 115px
- 실측: 카드 10건 전부 넘침 0, 최소 여유 215px. 극단값(59자 헤드라인·공백 없는 50자 법안명 4개) 주입 시
  머리부터 보이고 꼬리만 잘림 — 문서 가로 오버플로 0
- ⚠️ `layout: false` 라 **폰트를 뷰가 직접 로드한다.** `layout.ejs` 를 고쳐도 안 따라온다
  (큰 숫자용 `JetBrains Mono 700` 은 layout 이 안 받는 굵기라 여기서만 추가로 받는다)
- ⚠️ **동명 법안이라 대표발의자를 반드시 같이 실을 것.** 법안의 87%가 동명이라 이름만 늘어놓으면
  `소득세법 일부개정법률안` 이 두 줄 찍혀 **렌더링 버그처럼 보인다** (실제로 그렇게 나갔다).
  단 **정당은 넣지 않는다** — 카드 한 장에 정당명이 늘어서면 그 자체가 대비 구도가 된다
- ⚠️ 단위를 `건` 으로 뭉뚱그리지 말 것 — **사람은 `명`** 이다 (`대표발의 의원 13건` 이 나갔었다)
- 행이 2개 이하인 목록은 `is-few` 로 `space-evenly` 를 끈다. 안 끄면 366px 짜리 구멍이 생겨 두 줄이 남처럼 떨어진다
- 하단 브랜드는 **nav 락업과 같은 조립 규칙** — `[마크 46 · 워드마크 h34] │ [태그라인 h28]`,
  간격 2단 분리(브랜드 안 12px / 구분선 밖 16px). 단일 gap 으로는 위계가 안 나온다
  - ⚠️ **nav 비율(태그라인 h18)을 그대로 옮기면 안 된다.** nav 는 1:1 로 보지만 이 카드는
    **폰에서 ~2.8배 축소**돼 h22 가 8px 로 뭉개진다. 화면에서 읽히는 크기로 잡을 것 (h28 → 폰 약 10px)
  - 실측: 푸터 928px 중 84px 여유 (카드 10건 전부 오버플로 0)

##### PNG 뽑기 — `batch/genInstaCards.js` (`npm run insta`)
DevTools 노드 캡처를 N번 하는 건 **며칠이면 안 하게 된다.** `?slide=N` 을 1:1 로 만들어둔 게 이걸 위해서다.

```bash
npm run insta                    # 최신 카드
npm run insta -- --id 5
npm run insta -- --date 2026-08-10
# → out/insta/<YYYY-MM-DD>/01.png … NN.png + story.png + caption.txt
```
- **의존성 0개.** Playwright·Puppeteer 는 크로미움을 따로 받는데(~150MB), 이건 **로컬 전용 운영 도구**라
  (Railway 에 올릴 일이 없다) 이미 깔린 브라우저에 인자만 넘긴다. 윈도우는 Edge 가 항상 있어 사실상 늘 걸린다
- 전제: **서버가 떠 있어야 한다** (`npm start`). 페이지를 실제로 렌더해 찍는 방식
- 슬라이드 수는 **카드 페이지 HTML 에서 센다** (`data-slide=` 개수). 배치가 다시 계산하면 컨트롤러와 어긋난다
- ⚠️ `--force-device-scale-factor=1` 필수 — 고DPI 장비에서 2160×2700 으로 찍히는데
  **인스타가 알아서 줄여줘서 눈으로는 멀쩡해 보인다.** 그래서 PNG 헤더로 크기를 매번 검증한다
- ⚠️ `--virtual-time-budget=6000` 필수 — 없으면 웹폰트 로드 전에 찍혀 폴백 폰트로 나온다
- `caption.txt` 도 같이 쓴다 — **그대로 복사해 인스타 캡션 칸에 붙여넣는 텍스트**
  - 🔴 **캡션 조립은 `utils/instaCaption.js` 단일 소스다** (2026-08-16). 카드 미리보기 페이지(`/briefing/:id/card`, 쿼리 없음)
    하단에 **같은 함수로 만든 캡션 + 복사 버튼**이 있어 배치를 안 돌려도 웹에서 미리 보고 복사할 수 있다.
    캡처 모드(`?slide`·`?story`)에는 안 들어간다. 배치 쪽에 캡션 로직을 다시 쓰지 말 것 — 갈리면 미리보기와 산출물이 달라진다
  - 🔴 캡션은 **이미지를 반복하는 자리가 아니다.** 카드에 이미 있는 걸 다시 적으면 자막이 될 뿐이라
    본문(`body`)을 뺐다. 캡션만 할 수 있는 셋에 집중: ① 검색 유입 ② 프로필 링크 유도 ③ 고지
  - ⚠️ **인스타 캡션의 URL 은 클릭되지 않는다.** `→ dangmalsa.kr` 처럼 링크 모양으로 써두면
    눌러도 아무 일이 안 일어나 안 쓴 것만 못하다 → `프로필 링크에서` 로 유도
  - ⚠️ **첫 2줄만 보이고 나머지는 `... 더 보기` 로 접힌다** → 첫 줄은 헤드라인.
    날짜를 앞세우면 가장 비싼 자리를 카드 표지(54px 날짜)와 중복시킨다
  - 🔴 **해시태그는 캡션에 5개까지** (`MAX_TAGS`, 2026-08 확인). 배분은 고정 3(`국회·법안·당말사`)
    \+ 그날 주제 2 — 고정을 늘리면 매일 같은 태그만 반복돼 주제 신호가 사라진다.
    **`#정치`·`#시사` 는 넣지 않는다** — 쓰레드에서 `정치뉴스` 태그가 진영 글을 끌어온 것과 같은 위험.
    정당·인물 태그는 절대 금지
  - ⚠️ **키워드 태그는 길이로 거를 수밖에 없고 그 필터는 불완전하다.** `keywords` 는 AI 가 만든
    정책 구절이라 `#재생에너지`(진짜 검색어)와 `#무주택임차가구`(지어낸 말)가 섞인다.
    **올리기 전 마지막 줄만 눈으로 보고 손대는 게 맞다** — 휴리스틱이 못 잡는 유일한 부분이다
- 실측: 카드 8건 · 피드 50장 + 스토리 8장 전부 규격 통과, 경고 0

##### 유튜브 쇼츠 — `batch/genBriefingVideo.js` (`npm run video`, 2026-08-17)
1080×1920 MP4 + 제목/설명/SRT. 운영 시작 순서: ① 일간 브리핑 쇼츠(이것) → ② 성향 퀴즈 쇼츠 → ③ 유형 9종 소개 (사용자 결정 2026-08-17).

```
GET /api/briefing/export → video: { short, narration[], title }
   short     ← BriefingController.buildShort  「흐름 하나」 (기본 포맷) — 묶음 없으면 null
   narration ← BriefingController.buildNarration 「카드 7장」 (--format full)
batch/genBriefingVideo.js  → out/video/<날짜>/short.mp4 · title.txt · description.txt · narration.txt · sub.srt
utils/headlessShot.js      ← 헤드리스 캡처 공용 (genInstaCards 도 이걸 쓴다)
```
- 🔴 **기본은 「흐름 하나」 포맷이다** (2026-08-17 같은 날 뒤집음). 첫 판(카드 7장 통독, 59초)은 "목소리가 AI 같고 이걸 볼까" 는 피드백 —
  날짜·집계로 시작하고 주제가 5번 바뀌어 쇼츠 문법과 정반대였다. 지금은 **하루 한 영상 = 주제 묶음(thread) 하나**(bill_count 최대):
  `훅(what 문장 그대로 → "이런 법안이 8월 14일 국회에 나왔습니다") → 관련 법안 N건(한 줄씩 드러남) → 그날 맥락(발의 29건 중 3건) → CTA` 4장면 · 실측 **32.7초**.
  프레임은 카드 PNG 가 아니라 **HTML 로 직접 그린다**(`sceneHtml`, 카드와 같은 서체·골드 단색·정당 없음). 컷마다 내용을 조금씩 더 드러낸다.
  묶음이 없는 날(폴백·활동 없음)은 **영상을 만들지 않는다** — "볼 만한 날만" 이 매일 올리는 것보다 낫다. 문장은 전부 템플릿 + 카드에 이미 실린 theme·what (새 AI 호출 0)
- 🔴 **킥은 법안이 아니라 사람이다 — 「사람」 장면** (2026-08-17 A안, 사용자: "이목을 끌 킥포인트가 부족하다"). 뉴스는 당과 대표만 비추고
  지역구 의원 300명은 4년 내내 안 보인다 — 당말사만 답할 수 있는 건 "내가 뽑은 사람이 지금 뭐 하나". 흐름의 대표발의자 한 명(묶인 법안을 가장 많이 낸 사람,
  같으면 앞 — `pickShortPerson`, **데이터가 고른다**)의 사진·이름·지역구·선수 + `대표발의 N건(중앙값)` · `표결 참여 %` · `자기 당 vs 상대 당 찬성(격차·중앙값)` ·
  `상임위 참여율(평균)` 4줄이 한 줄씩 드러난다. 재료는 `loadShortPerson` 이 **의원 상세와 같은 서비스 메서드**로 받는다 (숫자가 사이트와 달라지면 안 된다).
  **정당 없음**(공유 카드 규칙) · 평가어 없음 · 숫자+중앙값만. 마무리 CTA 는 `당신 지역구 의원은 어떻게 일하고 있는지`. `getPost.sql thread_bills` 에 `mona_cd` 추가.
  사람 장면이 있으면 **맥락 장면은 뺀다** (사용자 결정, 50 → 44초) — 사람이 없는 날만 대신 들어간다. 실측 4장면 **44초** (사람 장면 18초 — 나레이션은 핵심 3~4문장만, 숫자는 화면이 보여준다)
- 🔴 **TTS 기본은 edge-tts** (`ko-KR-SunHiNeural`, `+8%`, 무료·키 없음, `pip3 install edge-tts` — CLI 가 PATH 에 없어도 `python3 -m edge_tts` 로 돈다).
  맥 `say`(Yuna) 는 `--tts say` 로만 — 2010년대 음성이라 "너무 AI 같다". edge 출력은 앞뒤 무음을 잘라(`silenceremove`) 컷 타이밍을 맞춘다
- 흐름(full 포맷): PNG 없으면 `genInstaCards` 먼저 → 슬라이드마다 TTS → 자막 컷(문장 → 26자 → 8자 미만 조각은 이웃에 붙임, 길이는 글자 수 비례)을
  **HTML 로 그려 헤드리스 크롬으로 프레임 캡처**(카드 상단 150px + 하단 자막 상자) → ffmpeg concat + apad 오디오 → mux
- 🔴 **자막을 ffmpeg 로 굽지 않는다** — brew ffmpeg 9 에 libass·drawtext 가 없고, 크롬으로 그리면 카드와 같은 서체·디자인을 우리가 통제한다.
  ffmpeg 9 는 `-vsync` 가 없다 (`-fps_mode vfr`), 그리고 `-r` 과 같이 쓰면 모순 에러
- 🔴 **60초 상한** — 실측 08-14 7장 **59.0초** (`--rate 205`, TAIL 0.45, MIN_SLIDE 3.0). 넘으면 로그 경고.
  줄일 곳은 배치가 아니라 **나레이션 문장**(`buildNarration`) — 흐름은 `N. 주제. what 첫 문장. 관련 법안 N건.`, 몰린 법률은 `일부개정법률안` 꼬리를 떼고 읽는다,
  마무리는 `자세한 내용은 당말사에서. 당 말고 사람.` 두 문장. 대표발의자 이름은 읽지 않는다 (귀로는 정보가 아니라 길이)
- 🔴 **맥 크롬은 `--screenshot` 을 다 찍고도 프로세스가 안 끝난다** (`--timeout` 도 무효, execFileSync 60초 ETIMEDOUT). PNG 는 1~2초 안에 나온다.
  → `utils/headlessShot.js` 가 spawn 후 **파일 크기가 600ms 안정되면 SIGKILL**. 윈도우 Edge 는 알아서 끝나지만 같은 경로로 무해.
  ⚠️ `genInstaCards.shoot` 도 이제 async 다 — 호출부에 `await` 가 있어야 순서가 지켜진다
- 설명란은 브리핑 링크 · 성향 진단 · 의원 목록 3링크 + AI 고지 (`description.txt`) — 쇼츠에서 사이트로 가는 길은 설명란뿐이다
- 업로드는 **일단 수동** (유튜브 스튜디오 드래그 + title/description 붙여넣기). API 업로드는 다음 단계. 로컬 전용 — 크론에 넣지 않는다

##### 스토리 `?story=1` — 1080×1920 (2026-08-14)
🔴 **인스타에서 탭 한 번에 사이트로 가는 유일한 통로가 스토리 링크 스티커다.**
피드 게시물은 `프로필 방문 → 링크 클릭` 2단계라 이탈이 크고, **캡션의 URL 은 클릭이 안 된다.**

- `?slide=N` 과 **별도 파라미터**를 쓴다 — 크기가 달라 같은 번호 체계에 못 들어간다
  (배치가 `--window-size` 를 다르게 줘야 함). 뷰는 `views/briefing/_card_story.ejs` 하나를
  미리보기·캡처 양쪽에서 include 한다 (갈리면 "미리보기는 멀쩡한데 올린 게 깨진다")
- 🔴 **위 250 / 아래 240 을 비운다** — 인스타 스토리 UI 가 상단(프로필·진행바)과
  하단(답장 입력바)을 덮는다. 안전영역 밖 글자는 앱에서 가려진다
- 🔴 **하단에 링크 스티커 자리를 디자인에 포함**한다(`.sl-sticker`, 300px).
  안 비워두면 카드 위에 스티커를 얹게 되고, 그러면 **스티커가 카드 디자인의 일부처럼 보여
  눌러야 할 것으로 안 읽힌다** (실제로 그렇게 올라갔다)
- 미리보기에는 `링크 스티커 자리` 안내선이 보이지만 **캡처에서는 숨긴다**(`body.story` 스코프)
- 헤드라인은 세로가 570px 더 길어 한 단계 크게 (`hlStory`)
- ⚠️ **링크 스티커 색을 흰색/검정으로 바꿀 것** — 인스타 기본은 파랑인데 이 브랜드는
  정당색(파랑·빨강)을 안 쓴다. 스티커를 탭하면 색이 순환한다
- 산출물 `out/` 은 `.gitignore` — 생성물이라 추적하지 않는다

- 손으로 뽑을 땐 **DevTools 의 `Capture node screenshot`**. 창 캡처는 화면 배율·DPI 를 타서 1080px 이 안 나온다
- 링크는 `res.locals.isAdmin` 일 때만 상세 페이지에 노출. **라우트 자체는 막지 않았다** —
  같은 공개 데이터를 다르게 그린 것뿐이고, 막으면 로그인 상태에 따라 미리보기가 안 되는 상황이 생긴다 (`noindex` 는 걸어둠)
- ⚠️ **AI 고지·출처 표기가 마무리 장에 반드시 있어야 한다.** 카드는 사이트 밖으로 나가므로 여기가 유일한 고지 지점이다

#### SNS 자동 게시 — 서비스 안에서 하지 않는다. `/api/briefing/export` 를 자동화 툴이 읽는다 (2026-08-16)
Meta 토큰·재시도·스케줄을 서비스에 들이지 않기로 했다 (사용자 결정). 우리는 **재료만** JSON 으로 내고,
Make · n8n 같은 툴이 매일 아침 이걸 읽어 올린다.

```
GET /api/briefing/export           → 최신 카드   (?date=YYYY-MM-DD · ?id=N 도 가능)
{ ready, id, date, kind:'ai'|'fallback'|'none', publishable, headline, url,
  threads: { limit:500, short:[{n,role,text,len}…3], full:[…6] },
  instagram: { caption, slideCount, slides:[…/card?slide=N], story:…/card?story=1, size } }
```
- 🔴 **`publishable` 이 false 면 올리지 말 것** — 폴백(`fallback`)·활동 없음(`none`) 카드는 게시 대상이 아니다. 툴의 필터 조건으로 건다
- 🔴 **멱등은 툴이 책임진다** — 같은 `id` 를 두 번 올리지 않도록 툴 쪽 데이터스토어(마지막 게시 id)로 막을 것. 서버는 게시 여부를 모른다
- 쓰레드: `short`(3개, 링크 1·3번) 를 권장 — 텍스트만이라 **툴만으로 완전 자동**이 된다. 체인은 `reply_to_id` 로 잇는다
- 인스타: `slides` 는 **HTML 페이지 URL**이다. Instagram API 는 공개 JPEG URL 을 요구하므로 툴에서 **스크린샷 서비스(URL→이미지, 뷰포트 1080×1350·1080×1920, DPR 1)** 를 한 단계 끼운다.
  🔴 **스토리 링크 스티커는 API 로 못 붙인다** — 스토리는 계속 수동 (사이트 유입의 유일한 탭 경로라 포기하면 안 된다)
- 보호: `BRIEFING_EXPORT_KEY` env 를 두면 `?key=` 또는 `X-Export-Key` 가 같아야 하고, 아니면 **404**(존재를 숨긴다). 공개 데이터라 없어도 동작한다. `/api` 는 robots 에서 이미 막혀 있다
- 응답 `Cache-Control: no-store` — 툴이 오래된 카드를 다시 올리지 않게. `id` 는 BIGINT 라 `Number()` 로 바꿔 낸다
- 배치 순서상 카드는 새벽 04:00 KST 체인 맨 뒤(`genBriefing`)에서 만들어지므로 툴 스케줄은 **05:00 이후**로

#### 프롬프트 v2 — 🔴 AI 에게 집계를 다시 말하게 시키지 말 것 (2026-08-11)
v1 은 `"3~4문장. 무엇이 몇 건 있었고 어디에 몰렸는지"` 를 시켰는데, 그건 **`composeFallback()` 의
직무기술서**였다. 결과적으로 AI 카드와 폴백 카드가 어순만 다른 같은 글이 나왔고
"AI 를 쓸 이유가 있나" 라는 결론에 도달했다. 되돌리지 말 것.

| | 2026-07-30 (발의 51건) 을 어떻게 봤나 |
|---|---|
| v1 | "국토교통위 11건, 보건복지위 9건, 기후에너지위 8건에서 발의가 집중됐다" |
| **v2** | **"인구감소지역 지원 25건"** — 지자체 의료·교육·주거 인프라에 국가가 우선 지원, 대학 설립기준 완화, 폐교를 체육·문화시설로 |

51건 중 절반이 하나의 정책 패키지였는데 v1 은 세 위원회로 흩어놨다.
⚠️ **이건 SQL 이 더 못하는 게 아니라 구조적으로 불가능한 일이다** — 집계 키가 `committee` 와
`bill_name` 인데 이 묶음은 14개 부처·서로 다른 법률에 걸쳐 있어 두 키 모두 묶음을 쪼갠다.
(08-10 "청년 자산 형성" 도 소득세법·조세특례제한법에 나뉘어 `bill_name` 그룹핑에 안 걸린다.)
**AI 가 값을 더하는 지점은 여기 하나뿐이다. 요약만 시킬 거면 AI 를 빼는 게 맞다.**

- 입력: 상위 5건 × 160자 → **그날 전건 × 400자**. 5건만 주면 "여러 건을 관통하는 주제" 요구 자체가 성립하지 않는다
- 출력에 `threads[{theme, what, bill_count, bill_ids}]` 추가 (0~3개, 2건 이상일 때만)
- 비용: 하루 $0.0035 → **$0.014~0.028** (법안 수에 비례, 51건이 최대 실측). 연 $1.3 → **약 $6**
- `prompt_version` 으로 세대를 가른다 — `'b1'`(집계 재서술, 폐기) / `'b2'`(주제 종합). 현재 25건 전부 b2
- ⚠️ 폴백은 `threads: []` 다 — 내용을 읽어야 나오는 것이라 SQL 로 만들 수 없다. 뷰가 빈 배열을 정상 처리한다
- ⚠️ `briefing_posts.id` 는 **연속하지 않는다** (실측 1~6, 13~16). `GENERATED ALWAYS AS IDENTITY` 가
  ON CONFLICT 판정 **전에** 값을 뽑아서 `--force` 재실행이 시퀀스를 태운다. 정상 동작이니 지우고 다시 넣지 말 것

#### 🔴 서비스 시작일 `START_DATE = '2026-08-13'` — 이 날짜 이전은 브리핑하지 않는다
과거 발의일이 **527일**(2024-05-30까지) 쌓여 있어서, 바닥이 없으면 배치가 매일 과거로 한 칸씩
파고든다. 롤링 창(`--window`)으로도 막히지만 그건 "얼마나 과거까지" 가 시간과 함께 움직인다 —
필요한 건 **고정된 시작점**이라 2026-08-12 에 창을 걷어내고 시작일로 교체했다.
- 과거 특정일을 굳이 만들려면 `--date 2026-07-01` — 시작일·주말·지연·중복검사를 **전부** 무시한다
- 시작일 이전 카드 25건(7/6~8/10)은 **남겨뒀다** (사용자 결정 2026-08-12). 생성만 8/13부터
- ⚠️ 시작일을 앞당길 거면 **페이지네이션이 먼저다.** 피드는 20건씩 끊는데 페이저가 없던 시절엔
  21번째부터 도달 수단이 아예 없어서 "매일 돈 써서 아무도 못 보는 카드를 만드는" 상태였다

#### 🔴 대상 날짜 선정은 **달력 기준**이다 (발의일 목록이 아니라)
`pickDays` 가 `generate_series(START_DATE, CURRENT_DATE - 1)` 로 달력을 깔고 거른다.
이전엔 `FROM bills` 로 뽑아서 **발의 0건인 날은 존재하지 않는 것처럼 취급**됐다 (카드도 로그도 없음).

| 날 | 처리 |
|---|---|
| 발의 or 처리 있음 | 대상 (주말이라도 — 주말 본회의 예외 대응) |
| 활동 없는 **평일** | 대상, 단 **지연 경과 후**. `model='none'` "활동 없음" 카드 |
| 활동 없는 **주말** | **제외** |

- ⚠️ **주말을 넣으면 안 된다.** 실측 최근 119일에서 주말 34일은 **예외 없이 전부** 발의 0건 —
  매주 토·일에 카드를 남기면 연 104장이 쌓이는데 국회가 원래 안 하는 날이라 정보가 아니라 노이즈다.
  평일 무발의는 85일 중 6일(7%)뿐이라 그건 진짜 신호다
- 🔴 **`INGEST_LAG_DAYS = 3` 이 "활동 없음" 카드의 안전장치다.** 원천 데이터가 **1~2일 늦게** 들어온다
  (실측: 8/10 발의분이 8/11 도착). 지연 전에 "이날은 발의가 없었다" 고 단정하면 실제로는 30건이
  발의됐는데 아직 안 들어온 것일 수 있고, 카드는 한 번 쓰면 안 고치므로 **거짓이 영구히 남는다**
- 그래서 자기 교정 장치도 뒀다 — `stats->>'proposed' = 0` 인 카드는 그 날짜에 법안이 **나중에
  들어오면 다시 생성 대상이 된다** (`pickDays` 의 `NOT EXISTS` 예외 절)
- "활동 없음" 카드는 **AI 를 부르지 않는다** ($0). 요약할 내용이 없는데 문장을 짓게 하면 없는 사실이
  나온다. 대신 "가장 최근 발의는 8.10(3일 전) 21건이었습니다" 를 붙여 공백의 길이를 알 수 있게 한다
- ⚠️ `shapePost` 의 `isAi` 를 `model !== 'fallback'` 로만 판정하면 **`'none'` 이 AI 카드로 표시된다.**
  `isEmpty` 를 따로 두고 배지·고지문을 3분기로 처리할 것 (AI 브리핑 / 데이터 요약 / 활동 없음)

#### 쓰레드 `/briefing/:id/threads` (2026-08-14)
같은 브리핑을 **쓰레드(Threads) 연결 게시물**로 쪼개 복사해 가는 자리. 조립은 `utils/threadsPost.js`.

인스타와 제약이 다르다 — **본문을 통째로 붙여넣는 게 아니라 체인으로 쪼개는 것**이 핵심이다:
| | 인스타 | 쓰레드 |
|---|---|---|
| 형식 | 이미지 캐러셀 | 텍스트 체인 (게시물당 **500자**) |
| 링크 | 캡션에서 죽음 | **살아 있음** → 유입 지점 |
| 제작 비용 | PNG 생성 필요 | 0 |

- 두 버전을 `?mode=` 로 고른다 (화면 상단 토글). **차이의 핵심은 길이가 아니라 링크 위치다:**
  | | 게시물 | 링크 | 법안 목록 |
  |---|---|---|---|
  | `full` (기본) | 6개 — `훅 → 본문 → 흐름 ×N → 마무리` | **맨 뒤** | 대표발의자까지 포함 |
  | `short` | 3개 — `훅 → 본문 → 흐름·마무리` | **1번 + 3번** | 생략 (링크 너머에 있다) |
- 🔴 **`full` 은 링크가 6번째라 체인을 끝까지 펼친 사람만 본다.** 쓰레드를 쓰는 유일한 이유가
  "링크가 살아 있다" 인데 그걸 맨 뒤에 둔 건 설계 착오였다 — `short` 는 그걸 고친 것이다.
  부수적으로 매일 복사가 6번 → 3번이 된다 (매일 하는 일이라 이 마찰이 곧 이탈이 된다)
- ⚠️ `short` 의 마지막 게시물에도 링크를 **다시** 넣는다. 쓰레드는 게시물 하나만 떼어져 돌아다닐 수 있어
  그 게시물만 본 사람에게도 출처로 가는 길이 있어야 한다
- 모르는 `mode` 값은 에러가 아니라 `full` 로 접는다
- ⚠️ **훅(1번)이 피드에 노출되는 전부다.** 여기서 멈추면 나머지는 안 읽힌다 →
  날짜·헤드라인·숫자만. 긴 고지문을 넣지 말 것 (`※ AI 정리` 로만 표시하고 상세 고지는 마지막에)
- 🔴 **파일이 아니라 페이지로 만들었다.** 쓰레드는 폰에서 올리므로, 배치가 `.txt` 를 떨궈봐야
  폰으로 옮기는 일이 남는다. 같은 이유로 `genInstaCards` 에 쓰레드 출력을 넣지 않았다 —
  배치 쿼리에는 `thread_bills` 가 없어 법안 이름이 빠진 반쪽이 되고 페이지와 내용이 어긋난다
- ⚠️ **분할은 문장 경계를 먼저 지킨다** (`splitToPosts`). 글자수로 뚝 자르면 문장이 반토막 난 채 끊긴다.
  폴백 순서: 문장 → 공백 → **코드포인트 하드컷**. 마지막 단계가 없으면 공백 없는 글이
  "단어 1개" 로 통과해 초과 게시물이 나간다 (실측 1300자가 안 쪼개졌다)
- ⚠️ 흐름 게시물도 분할을 태울 것. 법안 목록만 버리는 1차 폴백으로 끝냈다가 **727자가 나갔다**
- ⚠️ 글자수는 **코드포인트 기준**(`[...s].length`) — 이모지가 UTF-16 2칸이라 `.length` 는 과다 계산된다
- ⚠️ 링크는 `BASE_URL` 이 localhost 면 대표 도메인으로 떨어뜨린다 (`canonicalHost.js` 와 같은 판정).
  안 하면 복사 텍스트에 `localhost:3000` 이 박힌다
- **해시태그를 만들지 않는다** — 쓰레드는 게시물당 태그가 하나뿐이고, 정치 주제 태그는
  그 자체로 특정 진영 피드에 묶일 수 있다. 화면에 이유를 적어뒀다 (안 적으면 "빠뜨린 것" 으로 읽힌다)
- ⚠️ `.th-text` 는 `<pre>` 라 **`white-space: pre-wrap` 필수** — 기본값 `pre` 는 긴 줄이 가로로 삐져나간다
- 실측: 카드 9건 전부 초과 0. 극단값(헤드라인 200자·본문 1500자·흐름 theme 120+what 600자) 주입 시
  8개로 쪼개지고 초과 0. 활동없음·폴백 카드도 정상

#### "대기 중" 카드 (2026-08-14)
피드 맨 위에 **아직 카드가 없는 최근 평일**을 점선 카드로 그린다. 없으면 사용자가
**"고장인지 정상인지" 를 구분할 수 없다** — 원천 지연 때문에 최신 카드가 늘 1~2일 뒤처지기 때문이다.

- 🔴 **`briefing_posts` 에 미리 넣지 말 것.** `briefing_date` 가 UNIQUE 라 진짜 카드가 들어올 때 충돌하고,
  "카드는 한 번 쓰면 안 고친다" 는 원칙도 깨진다. **대기는 내용이 아니라 상태**라 렌더 시점에 계산한다
  (`getPendingDays.sql` → `BriefingService.getFeed`)
- 두 상태를 문구로 가른다 — 이유가 다르다:
  | | 배지 | 왜 |
  |---|---|---|
  | 오늘 | `진행 중` | 하루가 안 끝났다. 내일 새벽 배치가 만든다 |
  | 지난 평일 | `데이터 대기` | 국회 공개가 1~2일 늦다 (실측: 08-11분→08-13 도착, 08-12분→08-14 도착) |
- 🔴 **`PENDING_MAX_DAYS = 4` 상한이 안전장치다.** 배치가 오래 멈추면 "곧 올라옵니다" 딱지가
  2주치 쌓여 **그 자체가 거짓말**이 된다. 상한 밖은 아예 안 그린다
- ⚠️ **1페이지에만** 붙인다. 2페이지 이후는 과거 구간이라 맨 위에 "오늘 진행 중" 이 뜨면 그 자리에서 거짓이 된다
- ⚠️ **링크를 걸지 않는다** — 상세 페이지가 없어서 누르면 404 다. 그래서 hover 반응도 껐다
- ⚠️ 주말 제외 — `pickDays` 와 같은 판단. 주말 본회의 예외는 배치가 카드를 만들어주므로 `NOT EXISTS` 로 자연히 빠진다
- 같은 문구가 3~4장 반복되면 그 자체가 고장처럼 보인다 → 이유 문장은 **오늘 것 + 과거분 첫 장**에만
- 실측 검증: 08-14(금) 2장 / 08-15(토) 2장(토요일 자신은 제외) / 08-17(월) 2장(주말 건너뜀) / 4일 멈춤 가정 4장(상한).
  1페이지 22개(카드 20 + 대기 2) · 2페이지 대기 0 · `전체 27건` 은 실제 카드만 셈

#### 피드 페이지네이션
`/briefing?page=N`. **페이지 계산은 `BriefingService.getFeed(page)` 가 소유한다** — 컨트롤러가
offset 을 직접 만들면 `FEED_PAGE` 와 어긋나 카드가 건너뛰거나 중복된다.
총 건수를 먼저 구해 page 를 범위 안으로 접는다 (`?page=999` → 마지막, `0`·`abc`·`-3` → 1). 실측 검증 완료.
- 라벨은 `← 최신` / `이전 날짜 →` — 시간 역순 피드에서 "다음" 은 더 과거를 뜻해 방향이 헷갈린다
- 2페이지 이후는 `pageTitle` 에 `브리핑 N페이지` 로 표시 (탭·검색결과에서 같은 제목 반복 방지)

- ⚠️ **숫자는 AI 에게서 받지 않는다.** `stats` 는 SQL 집계 결과를 그대로 저장하고 AI 에겐 "이미 계산된 숫자" 를 주고 문장만 쓰게 한다. 숫자를 생성물에서 받으면 환각을 검증할 방법이 없다
  - **`threads[].bill_count` 도 마찬가지다.** AI 는 입력 목록의 **번호**만 돌려주고 `shapeThreads()` 가 실제 법안에 매핑해 개수를 센다. 실험에서 AI 에게 직접 세게 했더니 인구감소지역을 **21건이라 답했으나 실제는 25건**이었다 — 주제를 찾는 능력과 세는 능력은 별개다
  - 범위 밖 번호는 조용히 버리고, 유효 법안 2건 미만인 주제는 통째로 버린다
- ⚠️ **집계 범위 검사 `scopeCheck()`** — 중립성과 **다른 실패 모드**다. 숫자는 맞는데 기간을 틀리게 붙이는 것.
  실제로 하루치 24건이 **"7월 한 달간 24건"** 으로 나왔다 (7월 실제 합계 651건, 27배 오차).
  판정: **그 카드 자신의 월**이 `N일` 없이 나오면 탈락 (`8월 10일` ✅ / `7월 국회` ❌ / `8월 발의 26건` ❌) + 기간 단어 목록.
  - ⚠️ **"모든 `N월`" 을 검사하면 안 된다.** 처음에 그렇게 만들었다가 15건 중 **5건이 오탐 폴백**됐다 —
    `"한편 6월 지방선거 때 투표용지 부족으로…"` 처럼 법안이 언급한 과거 사건·시행 시기가 걸렸다.
    AI 가 집계 기간을 잘못 붙일 땐 **반드시 그 카드의 월**을 쓰므로(7월 데이터를 "10월 한 달간" 이라 하진 않는다) 자기 월만 본다
  - ⚠️ **탈락 사유에 앞뒤 문맥을 같이 남길 것.** 히트 단어만 찍으면 오탐인지 진짜인지 알 수 없어 고칠 근거가 없다 (실제로 `10월(일 없음)` 만 보고는 못 고쳤다)
  프롬프트에도 `[집계 범위] … **하루**` 로 명시한다 — 날짜만 주면 AI 가 기간을 임의로 넓힌다
- ⚠️ **`threads[].what` 도 `body` 와 같은 검사를 받아야 한다.** 화면에 그대로 나가므로, 본문만 검사하면 중립성·기간 문제가 threads 로 샌다
- ⚠️ **중립성이 이 배치의 최대 리스크다.** 프롬프트에서 정당 평가·대립 구도·의도 추측을 금지하고, 생성 후 **금지어 검사**(`여당`·`밀어붙`·`강행`·`독주` 등)로 한 번 더 거른다. 탈락하면 폐기하고 폴백으로 간다
- **카드 종류는 3가지이고 `model` 컬럼이 가른다.** 화면 배지도 이 셋으로 갈린다:

  | `model` | 배지 | 언제 |
  |---|---|---|
  | `claude-haiku-4-5-…` | 🤖 AI 브리핑 | 정상 |
  | `'fallback'` | 데이터 요약 | AI 실패(장애·키 만료·검사 탈락) → SQL 집계로 조립. 키 복구 후 `--force` 로 덮어쓴다 |
  | `'none'` | 활동 없음 | 그날 발의·처리가 0건. **AI 를 호출하지 않는다** ($0) |

  폴백은 집계된 사실만 이어 붙이므로 거짓이 안 들어간다 — 피드가 비는 것을 막는 장치다.
- 댓글·좋아요는 `comments.type` / `likes.type` 에 `'briefing'` 을 추가해 **기존 위젯을 그대로 재사용**한다
  - ⚠️ **DB CHECK 만 넓히면 안 된다.** `services/CommentService.js` 의 `VALID_TYPES`, `services/LikeService.js` 의 `VALID` 도 같이 넓혀야 한다 — 한쪽만 하면 조용히 400 이 난다 (실제로 겪음)
  - ⚠️ **`comments.target_id` 는 VARCHAR 인데 `likes.target_id` 는 INTEGER 다** (실측). 조인 시 전자는 `::text`, 후자는 그대로 비교해야 한다. 이 문서에 likes 가 VARCHAR(50) 으로 적혀 있었으나 실제 스키마와 다르다
- **뉴스는 검색 링크만** 만든다 (네이버·구글). 기사를 수집·표시하지 않는다 — 저작권 + "어느 매체를 고르느냐" 가 곧 편집 입장이 되는 중립성 문제
- 공유는 차트와 같은 방식 (`navigator.share` → 실패 시 링크 복사) + 카드별 OG 오버라이드

### `/briefing` 주간 요약 스트립 (구 1단계 대시보드)
```
daos/queries/briefing/*.sql   ← 9개 (스트립 7 + 피드 getFeed·getPost)
daos/BriefingDao.js           ← XrayDao 와 같은 "파일명 = 키" 로더
services/BriefingService.js   ← 조립 + 10분 메모리 캐시 + inflight 공유
controllers/BriefingController.js
```
> 스트립은 `views/briefing/feed.ejs` 상단에 통합돼 있다. 전용 뷰였던 `views/briefing/briefing.ejs`
> 는 피드 전환 후 **참조하는 코드가 한 곳도 없는 고아 파일**이 되어 2026-08-11 삭제했다.

**세 페이지의 역할 분담 — 이걸 어기면 곧 중복이 된다:**

| | 역할 |
|---|---|
| `/xray` | 누적 통계 (구조적 사실) |
| `/bill` | 검색·필터 **도구** (찾으러 가는 곳) |
| `/briefing` | **이번 주 무슨 법안이 올라왔나** (읽으러 오는 곳) |

- ⚠️ **집계 위주로 만들면 `/xray` 의 7일판이 된다.** 첫 버전이 그랬다 — "발의 많은 의원 TOP5" 는 xray 발의왕, "발의 리듬 큰 차트" 는 xray 월별추이와 같은 것이었다. **개별 법안 중심**으로 재편하고 집계는 맥락용 한 줄 스트립 + 스파크라인으로 압축했다
- 구성: 요약 스트립 → **이번 주 몰린 법률** → **위원회별 새 법안**(본체) → 누가 냈나 → 마지막으로 처리된 날
- **기간 창 `WINDOW_DAYS = 7`** (스파크라인만 14일). 발의는 평일마다 있어 7일이면 항상 찬다 (실측 98건)
- ⚠️ **처리(본회의·위원회)에는 기간 창을 걸면 안 된다.** 처리는 드물다 — 최근 7일 발의 98건인데 **처리는 0건**이었고 본회의 최근 처리일이 11일 전이었다. 7일로 자르면 그 블록이 늘 비어 기능이 죽는다.
  `getLatestProcessed.sql` 은 창 없이 **`MAX(proc_dt)` / `MAX(cmt_proc_dt)` 를 찾아 날짜와 `days_ago` 를 같이 준다** ("2026.07.31 · 11일 전")
- **`getHotLaws.sql` 이 브리핑의 고유 가치**다. `/xray` 에도 `/bill` 에도 없다 — "이번 주 조세특례제한법에만 11건(22대 누적 792건)" 에서 그 주의 관심사가 SQL 만으로 드러난다. AI 없이 서사가 나오는 유일한 지점
- ⚠️ `committee` 가 비어 있는 건 "미지정" 이 아니라 **아직 회부 전**이다. 그리고 **건수가 커서(실측 21건, 최다) 그냥 두면 첫 그룹으로 올라온다** — 주제가 아니라 상태라 브리핑 머리에 오면 안 된다. 서비스에서 실제 위원회를 먼저 세우고 **회부 전은 항상 맨 뒤**로 보낸다
- 스파크라인은 `generate_series` 로 **0인 날도 채운다.** 안 채우면 주말이 사라져 매일 발의되는 것처럼 보인다 (주말은 회색)
- **중립성**: 정당은 **표시하되 정당색을 쓰지 않는다.** 원칙은 "파랑·빨강 금지" 지 "정당 언급 금지" 가 아니다 — "누가 냈나" 는 브리핑의 핵심 질문이고 의원 목록·필터에서도 이미 정당을 쓴다. 막대는 정당 불문 **골드 단색**, 정렬·그룹 순서에 정당을 넣지 않는다
- ⚠️ **숫자에 해석 한계를 반드시 병기**: "공동발의 수 = 이름을 얼마나 걸었는지일 뿐 중요도·통과 가능성과 다름", "정당별 건수는 의석수가 달라 그대로 비교하면 오해". 해석 없이 순위만 놓으면 순위표가 된다
- **접기/펼치기**: 그룹당 기본 5건 + `이 위원회 N건 더` 토글, 페이지 하단에 `이번 주 발의 N건 전체 보기` (접힌 그룹 + 각 그룹 나머지를 한 번에). 기본 30건 → 전체 98건
  - 쿼리는 창 안 **전체**를 돌려주고 접는 건 뷰가 한다 → 토글이 서버 왕복 없이 즉시 동작
  - ⚠️ `.bf-rest` 는 `display: flex` 라 `[hidden]` 이 안 먹는다. `.bf-rest[hidden] { display: none }` 필수 (`bill_detail` 의 `.ba-proposers-grid` 와 같은 함정)
  - ⚠️ 전체 펼침 시 그룹별 토글 버튼 라벨도 같이 바꿔야 한다. 안 그러면 "더 보기" 인데 이미 펼쳐진 상태가 된다
  - ⚠️ "지금 N건 보이는 중" 안내는 접힘 상태 설명이라 펼치면 **숨긴다** (남기면 거짓말)
- 성능: 쿼리 6개 `Promise.all` 병렬 + 10분 캐시. 실측 TTFB **12ms**
  - ⚠️ **페이로드 178KB** — 창 안 전체(98건)를 한 번에 내려보내기 때문. 참고로 `/bill` 목록이 136KB
  - `summary` 는 SQL `LEFT(...,150)` + `summaryPreview(...,95)` 로 이중 절단. 카드가 2줄 클램프라 화면에 들어가는 건 90자 남짓이고, 그 이상은 98건 × 초과분이 곧바로 전송 낭비가 된다
  - ⚠️ **이 178KB 는 origin 기준이고 실제 사용자는 ~20KB 를 받는다** (2026-08-15 정정).
    Cloudflare 가 엣지에서 brotli 로 압축한다 — 아래 "전송 압축" 참조. `compression` 을 붙이지 말 것
- nav 위치: **홈 다음** (진입점 성격). nav 는 2행 구조라 9개가 되어도 여유 685px (1280px 기준)
- ⚠️ 서비스·컨트롤러(`.js`) 수정은 **서버 재시작** 해야 반영된다 (EJS 는 즉시). 그룹 정렬을 고치고 안 바뀌길래 한 번 헛짚었다

### `/politician/:id` 페이지 구조 (2026-04-25 재편 · 2026-08-15 레이아웃 개편)
- **히어로**: breadcrumb → `.profile-identity` **3열** (`auto | minmax(0,1fr) | 320px`) —
  아바타 240px | 이름·정당배지·메타·위원회 칩·`.profile-subinfo` | **「나와의 성향 일치」 패널**
  - 🔴 우측 칸이 생기기 전엔 `auto 1fr` 이라 **672px × 241px 이 완전 공백**이었다 (히어로 폭의 55%, 실측)
- **탭**: `[분석(기본), 법안 활동, 표결 내역, 국민 평가]`
- **분석 탭** (기본 활성):
  ```
  KPI 4칸 (발의 · 공동발의 · 표결참여 · 가결율) + 백분위 한 줄
  백분위 주의 문구 (.kpi-caveat)
  표결 성향 (전체폭 2단, 474)
  대표발의 (전체폭 카드, 안에서 2단) : 어떤 분야에 냈나(1.35fr) | 언제 냈나(1fr) + 바닥 전체폭 범례
  회의 발언 기록 (전체폭)
  ```
  - ⚠️ **`align-items: start` 필수.** 기본값(stretch)이면 한 행의 카드가 제일 큰 놈에 맞춰 늘어난다
    (실측: 관심분야 자연 310px 이 581px 로 늘어나 **271px 이 빈 흰 상자**였다)

#### 🔴 분석 탭 세로 리듬은 `#tab-overview` 의 **flex gap 하나**로 잡는다 (2026-08-16)
블록마다 margin 을 따로 주던 시절 실측 간격이 **0 / 10 / 16px 세 가지**로 갈렸고,
`.card` 에는 margin 이 아예 없어 **카드끼리 0px 로 맞붙은 곳이 두 군데**였다
(표결 성향↔대표발의, 정당별 협력↔발언 기록). 개별 margin 을 되살리지 말 것.

- `#tab-overview.active { display: flex; flex-direction: column; gap: 20px }` — 🔴 **`.active` 필수.** id 단독으로 두면 특이도가
  `.tab-panel { display:none }` 을 이겨 다른 탭을 눌러도 분석 탭이 아래에 그대로 남는다 (2026-08-16 실제 발생, 사용자 발견)
- 예외는 `.kpi-caveat` 하나 — KPI 행의 **전제**라 붙어 있어야 해서 `margin-top: -14px` 로 6px 까지 당긴다
- 실측 후: `6 · 20 · 20 · 20 · 20`. 카드 4장 전부 전체폭 1222px (1280px 기준)

#### 🔴 2단 카드는 **두 단의 높이가 맞아야** 한다 (2026-08-16)
`표결 성향`(574/571) · `정당별 협력`(285/285)은 맞아 있었는데 새로 만든 `대표발의`만 **720/309** 로
어긋나 **413px 이 빈 흰 상자**가 됐다. 두 번에 걸쳐 잡았다:

| 조치 | 효과 |
|---|---|
| 범례·해석 한계·링크를 패널에서 빼 **카드 바닥 전체폭(`.pr-foot`)** 으로 | 720 → 543 (산문은 넓을수록 잘 읽히기도 한다) |
| 월별을 연도 **탭 → 연도별 쌓기**(small multiples) | 309 → 442 |

→ 최종 **543 / 442 · 빈 공간 102px**.
- ⚠️ 카드를 나란히 두 장 놓는 것(`.overview-grid`)으로 되돌리지 말 것 — 빈 공간이 **카드 밖 그리드 셀**로
  옮겨갈 뿐이고, `align-items: start` 를 줘도 구분선이 짧게 끊겨 더 어색하다

#### 대표발의 특화 분야 `_propose_focus.ejs` · `.pf-*` (2026-08-16)
구 `대표발의 관심분야`(위원회 TOP5 **절대 건수** 막대)를 대체한다.

🔴 **절대 건수는 "이 사람만의 것" 을 말하지 못한다.** 실측 윤준병:

| 위원회 | 건수 | 본인 비중 | 의원 평균 | 배수 |
|---|---|---|---|---|
| 농림축산식품해양수산 | 115 | 34.4% | 6.5% | **5.3배** ← 신호 |
| 행정안전 | 57 | 17.1% | 13.8% | 1.2배 |
| 법제사법 | 18 | 5.4% | 9.3% | **0.6배** (평균 이하) |

2위 아래는 전부 평균 수준이거나 그 이하인데 **막대 다섯 줄이 같은 무게로 읽혀** 그 차이를 말하지 못했다.

- **축은 `lift` = (본인 비중) / (전 의원 대표발의 중 그 위원회 비중).** 실측 근거: 1위 위원회 lift
  중앙값 **5.95배**, 315명 중 **269명(85%)이 3배 이상** — 거의 전원에게 특화 분야가 드러난다
  (김건 외통위 50.1배 · 부승찬 국방위 25.7배)
- 🔴 **결론은 건수 1위가 아니라 `lift` 최대를 말한다.** 처음엔 1위의 lift 를 썼다가 깨졌다 —
  김기현은 결론이 `행정안전위 ×1.3` 인데 목록 맨 아래에 `외교통일위 ×7.6` 이 있어
  **결론이 목록과 모순되게 읽혔다.** 둘이 다르면 **둘 다** 쓴다
  (`X가 가장 많지만(9건), 평균 대비로는 Y가 가장 두드러집니다 — 4건으로 평균의 7.6배`)
  - 결론이 가리키는 행은 `.is-peak` 로 표시한다 (없으면 다섯 줄에서 눈으로 찾아야 한다).
    실측 120명 중 **115명이 강조 1행 · 5명이 0행**(lift<3 → "고르게 걸쳐 있습니다")
  - ⚠️ **건수를 반드시 같이 쓴다** — 김기현 외통위는 **4건**이다. 배수만 내면 소표본이 숨는다
- ⚠️ **목록 정렬은 건수 순이다.** lift 순으로 두면 5건짜리 소규모 위원회가 1위로 올라온다
- 🔴 **막대는 두 줄이다 — `본인` / `평균` 을 같은 눈금(0~100%)에 나란히**. 마커 방식을 되돌리지 말 것.
  처음엔 골드 막대 하나(본인 비중) + 평균 위치 마커로 만들었다가 **안 읽힌다는 지적을 받았다**:
  | 무엇이 문제였나 | |
  |---|---|
  | 마커가 막대 **안에** 묻힌다 | 본인 > 평균이면 항상 그렇다 (실측 국토위 62.9% vs 8.5%) → 기준선이 아니라 "막대를 자르는 구분선" 으로 보인다 |
  | 범례가 화면과 안 맞는다 | "눈금은 …" 이라 써놨는데 화면엔 축이 없다. 그건 막대다 |
  | 숫자가 막대와 안 붙는다 | `본인 62.9%` 와 `의원 평균 8.5%` 를 아랫줄 **좌우 끝**에 갈라놔서 어느 게 어느 막대인지 안 보였다 |
  | **`×N` 이 그림에서 안 나온다** | 막대 하나와 점 하나에서 7.4배를 읽을 방법이 없다 (이게 결정적) |
  → 두 막대면 **길이 비가 곧 배수**다. 실측 검증(이연희): 표기 ×7.4 ↔ 실제 막대 길이 비 **7.3배** ·
  ×5.5 ↔ 5.4배 · ×0.5 ↔ 0.5배. 라벨·막대·숫자를 **한 줄에** 묶어 연결이 보이게 한다
  - ⚠️ **막대에 `lift` 를 그리지 말 것** — 상한이 없어 50배짜리 하나가 나머지를 0 으로 눌러버린다
  - ⚠️ 눈금은 **0~100% 절대**다. 행마다 최댓값으로 정규화하면 "꽉 찬 막대" 의 뜻이 행마다 달라진다
  - ⚠️ `.pf-fill { min-width: 3px }` 필수 — 모바일 트랙이 **131px** 이라 1.1% 짜리 평균 막대가 1px 이 되어
    사실상 안 보인다 (`.sp-kind-fill`·`.vp-seg` 와 같은 함정). 그 대가로 아주 작은 값에서는 길이 비가
    실제보다 작아지지만 **숫자가 바로 옆에 있고**, 안 보이는 막대보다 낫다. 데스크톱(607px)은 0.5% 라 영향 없다
  - ⚠️ `.pf-val` 은 **고정폭(88px)** — 행마다 폭이 다르면 막대 끝이 들쭉날쭉해 길이 비교가 무너진다
- 🔴 **평균 이하(1배 미만)도 지우지 말 것** — 무엇을 안 하는지도 이 사람의 모습이고,
  지우면 TOP5 합이 안 맞아 "나머지는 어디 갔나" 가 된다
- 🔴 **`.pf-row` 좌우 여백은 전 행에 똑같이 준다.** 강조 행에만 주면 그 줄만 밀려 어긋나고,
  음수 마진으로 맞추면 `.pf-list` 가 가로로 넘친다 (실제로 그렇게 나왔다)
- 🔴 **분모가 KPI 와 다르다.** 이 카드는 **위원회가 정해진 건수**가 분모라 회부 전 법안만큼 작다
  (실측 윤준병 KPI 336 vs 카드 334). 같은 페이지에 두 숫자가 뜨므로 **각주가 차이를 숫자로 말한다**
  (`대표발의 336건 중 회부 전 2건은 …`). 차이가 0이면 그 줄을 안 쓴다. 실측 80명 중 10명에서 노출
- ⚠️ **AI 주제(`bill_ai_analysis.category_main`)로는 못 만든다** — 커버리지가 **0.62%**(18,741건 중 116건)라
  의원당 0~1건이다. 당분간 위원회가 유일한 주제 축이다. 커버리지가 오르면 그때 다시 볼 것
- ⚠️ 해석 한계 3줄은 숫자와 세트다: ① 위원회는 **배정**되는 것이라 전부 본인 선택이 아니다
  ② 위원회마다 법안 총량이 크게 다르다(법사 9.3% vs 여가 0.2%) — 그래서 배수로 본다 ③ 회부 전은 빠진다
- 정당색 금지 — 골드(평균 이상) / 무채색(평균 이하)
- 쿼리는 전 의원 집계를 같이 낸다 (`ov` CTE 가 bills Seq Scan). 실측 **23ms** — 13개 쿼리와
  `Promise.all` 로 병렬이라 TTFB 에 영향 없다. 더 무거워지면 `kpiPercentiles` 처럼 캐시할 것

#### 🔴 `주요 법안 이력` 카드는 삭제했다 (2026-08-16). 되살리지 말 것
쿼리가 `ORDER BY propose_dt DESC LIMIT 5` 라 **"주요" 가 아니라 "최근"** 이었고,
**법안 활동 탭에서 `대표발의` 를 누른 첫 5줄과 정확히 같았다** (같은 페이지 안의 중복).
실측 윤준병: 5건 전부 계류, 전부 최근 8일 이내 — 타임라인이라 부를 게 없다.
진짜 "주요" 로 바꾸려면 가결 우선이 자연스러운데 **가결이 있는 의원이 215/315(68%)에 중앙값 1건**이라 그것도 빈약하다.
→ 카드·쿼리(`getTimelineByMonaCd.sql`)·DAO·서비스·컨트롤러·CSS(`.timeline`/`.tl-*`) 전부 제거. 참조 0.

#### 월별 대표발의 `_propose_months.ejs` — 연도별로 쌓는다 (2026-08-16)
🔴 **최근 12개월 롤링 창을 되돌리지 말 것.** 그 창이 덮는 건 대표발의 전체의 **38.5%** 뿐이었다
(실측 18,741건 중 7,209건). 임기(2024-05~2028-05)가 길어질수록 더 나빠지고,
같은 페이지 `월별 표결 참여` 는 연도 기준인데 이쪽만 롤링 창이라 **두 시계열의 시간 축이 달랐다.**

- 🔴 **연도 탭이 아니라 연도별로 쌓는다** (small multiples). 탭으로 만들었다가 되돌렸다:
  ① `발의 건수` 에서 자연스러운 질문은 "언제 활발했나" 인데 **탭은 그걸 클릭 뒤로 숨긴다.**
  표결 참여는 각 달이 `참여율`(비율)이라 한 해만 봐도 답이 되지만 이쪽은 다르다
  ② 부수효과로 부모 카드의 두 단 높이가 맞는다 (245 → 442, 위 항목 참조)
  - ⚠️ 그래서 `_vote_profile.ejs` 의 월별 표결 참여(연도 탭)와 **형태가 다르다. 의도된 차이다**
- 🔴 **최댓값은 전 연도 공통**이어야 한다. 해마다 따로 잡으면 높이 기준이 달라져
  "2024년이 2026년보다 활발했나" 를 눈으로 비교할 수 없다 — 쌓아 놓는 의미가 사라진다
- 표결 쪽과 **같게** 유지하는 셋: ① 1~12월 고정 슬롯(진짜 달력 축) ② 발의 없는 달은 **빈 칸**
  ③ 축 눈금 (해마다 붙인다 — 한 번만 두면 아래 해를 볼 때 시선이 위로 올라가야 한다)
- 지표 자체는 **유의미하다**: 개인 월별 패턴과 국회 전체 패턴의 상관이 **중앙값 0.309**
  (0.5 이상은 229명 중 63명, 28%) — "국회 일정만 보여준다" 는 의심은 실측으로 기각됐다

#### 🔴 `.pr-grid`·`.pf-panel` 은 **900px 미디어 쿼리보다 앞**에 둘 것 (2026-08-16)
파일 뒤쪽(1490행대)에 뒀다가 같은 특이도에서 **나중 규칙이 이겨** 900px 이하에서도 2열이 유지되고
구분선이 세로로 남았다. `.profile-kpis-row` 때와 **완전히 같은 함정** — 파일 순서가 곧 우선순위다.
⚠️ 증상이 헷갈린다: `border-top` 은 미디어 쿼리 값(1px)이 먹고 `border-left`·`grid-template-columns` 만
베이스에 덮여서, "미디어 쿼리가 반쯤 먹은" 것처럼 보인다.

#### 분석 탭 목차 `.ov-toc` (2026-08-16)
분석 탭이 카드 5종 **3,068px**(1600px 실측)이라 "뭐가 들어있는지" 를 훑을 수단이 없었다.
탭바 아래 sticky 칩 줄 — `활동 지표 · 표결 성향 · 대표발의 · 정당별 협력 · 발언 기록`.

- 🔴 **히어로에 분석 요약을 얹는 안을 버리고 이걸 택했다** (2026-08-16 검토). 분석 탭이 **기본 활성**이라
  히어로 바로 아래가 이미 KPI 4칸이고, 무엇보다 이 페이지의 숫자는 **조건을 떼면 거짓이 된다**
  (가결율은 계류 76% 때문에 백분위 자체가 없고, 발의·표결참여는 국무위원·의장단·중도합류를 뺀 값이다).
  요약은 정의상 그 단서를 떼어놓아 곧바로 **성적표**가 된다 — `.kpi-caveat` 를 둔 이유와 정면 충돌
- 🔴 **항목은 JS 가 `#tab-overview [data-toc]` 를 읽어 만든다. 목록을 손으로 적지 말 것** —
  `정당별 협력`(`_out || _in`) · `발언 기록`(`speeches`) 은 데이터가 없으면 렌더 자체가 안 돼서
  고정 목록이면 없는 곳으로 보내는 칩이 생긴다. 카드를 추가할 때도 `data-toc` 한 줄이면 끝난다
  - ⚠️ 실측 2026-08-16 **309명 전원 5개** — "3개짜리를 아직 못 봤다" 는 뜻이지 분기가 없다는 뜻이 아니다
- 🔴 **탭바와 목차를 `.tab-head` 하나로 묶어 통째로 sticky 시킨다.** 따로 시키면 목차의 `top` 을
  `nav + 탭바높이` 로 계산해야 하는데 탭바는 가로 스크롤 컨테이너라 높이가 흔들린다
  (`/bill`·`/politician` 목록의 `.sticky-head` 와 완전히 같은 판단). `.tab-bar` 는 이제 static
- 🔴 **`.overview-grid.three` 는 세 장에 각각이 아니라 행 하나에 앵커를 건다** — 데스크톱에선 나란히
  놓여 어느 칩을 눌러도 같은 지점에 닿는다. 셋 다 `bills.mona_cd`(대표발의) 기준이라 묶어도 정직하다
- 🔴 **스크롤 오프셋에 `head.getBoundingClientRect().bottom` 을 쓰지 말 것** — 아직 안 붙은 상태
  (페이지 최상단)에서는 히어로 높이만큼 큰 값이 나와 덜 스크롤한다. `--nav-h`(반응형) + `offsetHeight` 로 계산
- 🔴 **초기 표시·탭 전환에 `requestAnimationFrame` 을 쓰지 말 것** — 배경 탭·비가시 상태에서는
  콜백이 아예 안 돌아 **활성 칩이 하나도 없는 채로 뜬다** (실제로 그렇게 나왔다). rAF 는 scroll throttle
  에만 — 거기선 "렌더링을 안 하면 갱신할 것도 없다" 가 참이다 (모바일 select 이동에서 겪은 것과 같은 함정)
- ⚠️ 활성 추적은 **DOM 순서 순회**다. IntersectionObserver 의 좁은 활성 띠는 짧은 마지막 섹션을 못 잡는다
  (`bill_detail` 의 sticky 인덱스와 같은 방식) + 페이지 끝에서는 마지막을 강제 활성
- ⚠️ 배경·보더는 **가운데 정렬된 `.ov-toc-inner` 에** 준다 (`.tab-bar-inner` 과 같은 처리).
  바깥 요소에 주면 1280px 초과 화면에서 목차 줄만 흰색이 끝까지 뻗어 바로 위 탭바와 어긋난다
- ⚠️ 12.5px 소형 텍스트라 대비 4.5:1 필요 — 활성색은 `--accent`(3.79 미달)가 아니라 **`--accent2`**(5.4)
- **고정 크롬 실측**: 데스크톱 155 → **203px**(800px 의 25%) · 모바일 375px 115 → **163px**(20%).
  목록 페이지(231px · 29%)보다 얇다. 여기서 더 키우지 말 것
- 실측 2026-08-16: 375·820·1280·1600px 가로 오버플로 0, 칩 1행 유지(375px 은 가로 스크롤).
  `#comments` 해시 진입 시 목차는 정상적으로 숨은 채 뜬다

#### 법안 활동 탭 · 월별 표결 패널 — API 지연 로딩 (2026-08-15)
🔴 **행을 SSR 로 뿌리지 말 것.** 의원 상세가 **1,187KB** 였던 원인이다.

| | 전 | 후 |
|---|---|---|
| 법안 활동 탭 | `bills` 전건 **887행** SSR 후 JS 가 `display:none` 으로 20개씩 접음 | 탭을 **열 때** API 로 20행만 |
| 월별 표결 패널 | 598건 전건을 `__VOTE_MONTHS__` JSON 에 심음 (75KB) | 막대 클릭 시 **그 달만** API |
| **페이지** | **1,187KB** | **190KB** (−84%) |

- 엔드포인트 (`routes/ApiRoutes.js`):
  `GET /api/politician/:monaCd/bills?kind=all|rep|co&page=N`
  `GET /api/politician/:monaCd/votes?ym=YYYY-MM` (월별 패널) — **`ym` 없으면 표결 내역 탭 한 페이지**
  (`?page=N&per=20&result=찬성|반대|기권|불참`). ⚠️ 컨트롤러에서 **`ym` 분기를 먼저** 둘 것 —
  뒤로 가면 월별 패널이 페이지 응답을 받는다

#### 표결 내역 탭도 페이징 (2026-08-16)
🔴 **`votes.slice(0, 50)` 이던 시절엔 나머지 548건에 도달할 방법이 아예 없었다.**
쿼리는 `LIMIT` 없이 전건을 읽고 뷰가 50건만 그렸다 — 읽어놓고 안 보여주는 상태.
법안 활동 탭은 이미 페이징인데 여기만 잘려 있었다.

- 첫 **20건 SSR** + **번호 페이징**으로 나머지 (행 하나 630B — 598건을 다 뿌리면 **+345KB**)
  - 🔴 **`더 보기` 로 만들었다가 번호 페이징으로 바꿨다** (2026-08-16). 598건이면 끝까지 **30번**을
    눌러야 하고, 누른 만큼 DOM 에 행이 쌓이며, 무엇보다 **같은 페이지의 법안 활동 탭이 이미
    번호 페이징**이라 두 탭이 다르게 동작했다. `.pagination-inline` 컴포넌트를 그대로 쓴다
  - ⚠️ 첫 페이지는 SSR 이므로 진입 시 **API 요청 0회** — 페이저만 그린다
  - ⚠️ 필터를 바꾸면 **`page = 1` 로 되돌릴 것.** 안 하면 7페이지에서 `반대`(1페이지뿐)로 바꿀 때
    범위 밖을 요청해 빈 목록이 된다

#### 페이저는 `renderPager` 하나로 (2026-08-16)
의원 상세의 두 탭이 각자 `drawPager` 를 갖고 있었다 → 한 곳만 고치면 같은 페이지 안에서 모양이 갈린다.
공용 헬퍼로 합치고 **처음(`«`)·마지막(`»`) 이동**을 넣었다.

- 🔴 **창(window) 방식 페이저엔 `«` `»` 가 필요하다.** 현재±3 만 보여주므로 창 밖으로 나갈 방법이
  없었다 — 30페이지면 `→` 를 29번 눌러야 했다.
  ⚠️ 서버 렌더 목록(`/bill`·`/community`)은 `1 … totalPages` 를 직접 그려 **이미 끝으로 갈 수 있다.**
  거기까지 손대지 말 것 (마크업·클래스가 다르다: `.pg-btn` / `.cm-pg-btn` vs `.pg`)
- 월별 표결 패널(`.vtd-pg`)도 같이 — **`data-d`(±1 델타) → `data-p`(절대 페이지)** 로 바꿔야
  처음·끝으로 한 번에 간다
- 🔴 **`busy`/`loading` 을 내린 **뒤에** 페이저를 그릴 것.** 법안 활동 탭은 `.then()` 안에서
  그리는데 `busy` 는 `.finally()` 에서 내려가, 공용 헬퍼가 **버튼을 전부 disabled 로 그렸다** (실제 발생)
- **결과별 필터 칩**(전체·찬성·반대·기권·불참) — 개수는 `voteSummary` 에서 온다 (추가 쿼리 0).
  ⚠️ **0건인 결과는 칩을 그리지 않는다** (누를 수 없는 칩은 노이즈 — 월별 패널과 같은 규칙)
- 🔴 **`getVotesByMonaCd.sql`(전건)과 `getVotesPageByMonaCd.sql`(페이지)의 정렬이 같아야 한다**
  (`vote_date DESC, bill_id DESC`). 전건이 `vote_date DESC` 뿐이던 탓에 SSR 첫 20건과
  API 2페이지의 경계가 어긋나 **3건이 중복**됐다 (실측). 같은 날 표결이 수십 건이라 tiebreaker 없이는 순서가 안 고정된다
- 🔴 JS 의 `PROC_CLASS` 는 뷰 상단 `resultClass()` 와 **글자 그대로 같은 매핑**이어야 한다.
  다르면 "더 보기" 로 붙은 행만 배지 색이 달라진다
- ⚠️ **`window.__MONA_CD__` 에 의존하지 말 것** — `_vote_profile.ejs` 가 **월별 추이를 그릴 때만**
  정의한다 (표결월 4개 미만이면 undefined). 같은 IIFE 의 `MONA_CD` 를 쓸 것
- ⚠️ `#vote-status` 의 `data-total` 이 없으면 첫 렌더가 `20건 / 전체 20건` 이 된다 (총계를 API 응답 전엔 모른다)

> **전 페이지 제목 계층 감사** (2026-08-16). 12개 페이지를 훑어 실측한 결과 —
> 대부분은 이미 `페이지 제목(세리프 44) → 섹션(24) → 항목` 으로 잡혀 있었고 **문제는 두 곳뿐**이었다:
> `/politician/:id` 분석 탭(계층 역전)과 `/briefing/:id`(섹션 제목과 하위 항목이 15px/700 로 동일).
> - ✅ 정상: `/`(76.8→24) · `/bill`(44→…) · `/bill/:id`(36→24→22→19) · `/xray`(44→18/900) ·
>   `/xray/chart`(44→24) · `/about`(44→24→16) · `/glossary`(mono kicker + 22) · `/balance-game`(44→30)
> - ⚠️ `/politician` 목록의 사이드바 제목은 **mono 12px 라벨**이다 (제목이 아니라 분류 라벨 — 의도된 처리)
> - ⚠️ `/community` 는 글이 없어 판정 불가. 글이 쌓이면 다시 볼 것

#### 제목 3단계 (2026-08-16)
분석 탭은 내용이 많은데 **제목이 본문처럼 읽혔다.** 계층이 실제로 **뒤집혀** 있었기 때문이다 —
카드 제목이 `14px/600` 인데 그 **안의** 소제목이 `13.5px/700` 이라 상위가 더 가늘었다.

| 단계 | 대상 | 스타일 |
|---|---|---|
| **L1** 카드 제목 | `.card-title` | **Noto Serif KR 900 / 17px** — 폰트가 달라 한눈에 제목으로 읽힌다 |
| **L2** 섹션 소제목 | `.vp-h` · `.pc-h` | 산세리프 800 / 14px + **골드 좌측 바 3px** |
| **L3** 하위 라벨 | `.vp-trend-h` · `.sp-sub-title` | 700 / 11.5px + 자간 0.04em · `--sub` |

- 🔴 **크기만으로 가르려 하지 말 것.** 이 페이지는 11.5~15px 구간에 전부 몰려 있어 1~2px 차이는
  구분이 안 된다. **폰트·굵기·색·장식**을 같이 바꿔야 한다
- L1 을 세리프로 쓴 건 `/xray` 카드 제목(Noto Serif KR 900)과 같은 처리다 — 사이트에서 "섹션 제목"
  의 시각 언어를 하나로 맞춘다. ⚠️ 이 페이지엔 그전까지 **세리프가 한 글자도 없었다**
- 🔴 **제목은 위 간격이 아래보다 넓어야** 아래 내용에 묶여 읽힌다 (근접성).
  `회의 종류` 가 위 0 / 아래 10 이라 앞 블록에 붙어 보였다 → `:not(:first-child)` 에 `margin-top`.
  ⚠️ 첫 자식엔 주지 말 것 — 카드 padding 과 겹쳐 위가 뜬다
- ⚠️ 법안 활동·표결 내역·국민 평가 탭은 카드 제목이 **없다** (탭 라벨이 그 역할). 억지로 넣지 말 것

#### 표결 요약 카드 (`.vote-tally`, 2026-08-16)
목록 위에 `전체 / 찬성 / 반대 / 기권 / 불참`. `voteSummary` 재사용이라 **추가 쿼리 0**.
- 🔴 **분모가 둘이다** — 찬성·반대·기권은 참여분(536), 불참은 전체(598). 다섯을 한 줄에 나란히 두면
  "더해도 100%가 안 되는데?" 가 된다 → 불참은 **점선으로 끊고** 각각 분모를 명시.
  ⚠️ 모바일 2열에선 불참이 왼쪽 열로 가므로 세로 점선을 **상단 점선**으로 바꾼다
- `기권`(참여했으나 찬반 미선택) 과 `불참`(표결 자체에 불참) 의 차이를 한 줄로 설명한다

#### 🔴 두 탭이 `.bill-table-header` / `.bill-table-row` 를 **공유한다** (2026-08-16)
열 구성이 서로 다르므로 **`grid-template-columns` 는 반드시 탭별로 준다.** 공통에 두지 말 것.

| 열 | `#tab-bills` 법안 활동 (4열) | `#tab-votes` 표결 내역 (5열) |
|---|---|---|
| 1 `minmax(0,1fr)` | 법안명 | 법안명 |
| 2 `104px` | 구분 | 표결결과 |
| 3 `104px` | 제안일 | 표결일 |
| 4 | **처리결과 `150px`** (보조줄 포함) | 처리결과 `108px` |
| 5 `200px` | — | 소관위원회 |

- 🔴 **실제로 사고가 났다.** 표결 내역 탭의 위원회명이 잘려 5번째 열을 90 → 200px 로 넓혔는데
  공통 규칙이라 **법안 활동 탭의 `표결` 열까지 200px** 가 됐다 (97%가 빈 칸인 열에 200px)
- ≤1024px 은 두 탭 모두 3·5번째를 숨겨 **3열**(`1fr 80px 88px`)로 접는다.
  법안 활동 탭은 5번째가 없어 그 셀렉터가 no-op 이지만 **지우지 말 것** — 같은 클래스라 한쪽만 남기면 나머지가 어긋난다

#### 표결 내역 표 — 마지막 열은 위원회명이다
⚠️ 헤더가 `카테고리` 였지만 값은 `문화체육관광위원회` 같은 **위원회명**이라 `소관위원회` 로 고쳤다.
🔴 열 폭이 **90px** 이던 시절 50행 중 **44행이 칸 밖으로 삐져나왔다** (`산업통상자원중소벤처기업위원회`
= 200px, 최대 110px 초과). 200px 로 넓히고 배지에 `overflow-wrap: anywhere` —
**공백이 없는 한 덩어리**라 `keep-all` 만으로는 절대 안 접힌다 (`.tl-label`·위원회 칩과 같은 함정)

#### 🔴 법안 활동 탭의 `표결` 열은 없앴다 — `처리결과` 보조줄로 병합 (2026-08-16)
**본회의 표결이 붙는 법안이 전체의 3.19%**(18,741건 중 598건)뿐이라 열이 거의 항상 비어 있었다.
게다가 목록이 최신순이라 **첫 페이지 20행이 전부 `—`** 였다 (실측) — 통째로 고장난 것처럼 보인다.

실측(윤준병, 법안 2,106건 중 표결기록 **62건 = 2.94%**):

| 처리결과 | 건수 | 본인 표결기록 |
|---|---|---|
| (계류) | 1,561 | **0** — 본회의 미도달 |
| 대안반영폐기 | 456 | **0** — 위원회 대안으로 흡수돼 **원안엔 표결 자체가 없다** (표결은 '대안' 쪽에 붙는다) |
| 수정가결 | 50 | 50 |
| 철회 / 폐기 | 23 | **0** — 본회의를 안 거친다 |
| 원안가결 | 12 | 12 |

- 🔴 **빈 이유는 바로 왼쪽 `처리결과` 가 이미 말하고 있었다.** 두 열이 사실상 같은 정보를 담고,
  표결 열은 그중 3%에만 뭔가를 덧붙이는 구조였다
- 🔴 **덧붙이는 그 내용조차 변별력이 없다** — 본인이 발의·공동발의한 법안에 대한 본인 표결은
  전 의원 통틀어 **찬성 88.05% / 불참 11.95%**, **반대·기권 0건**이다 (자기 법안에 반대한 의원은 없다)
- → 정보를 버리지 않고 `처리결과` 칸의 **보조줄**로 옮겼다 (계류 `+N일` 이 쓰던 그 자리).
  **둘은 동시에 성립하지 않아**(계류면 표결이 없다) 한 슬롯으로 충분하다. 5열 → 4열,
  법안명 칸 620 → **790px**(1280px 실측)
- ⚠️ 보조줄은 칩이 아니라 **글자색만** 쓴다 (`.bill-row-myvote b`). 칩으로 만들면 행이 높아지고
  옆 처리결과 배지와 무게가 같아진다. 초록·빨강은 본회의 표결 결과(객관 데이터)라 허용
- ⚠️ **`찬성`·`불참` 만 나온다고 가정하지 말 것** — 현재 분포가 그럴 뿐 원천은 네 값을 준다. `VOTE_CLASS` 로 전부 받는다
- ⚠️ ≤1024px 에서 **처리결과 배지에 줄바꿈을 걸어야 한다** — `수정안반영폐기` 가 nowrap 이면 **104px** 이라
  88px 칸을 16px 넘어간다 (실측). **문서 가로 스크롤은 안 생겨서 눈치채기 어렵다**
- 🔴 **필터·페이지가 서버로 넘어갔다.** 예전처럼 DOM 을 훑어 거르지 말 것 — 한 페이지만 있으므로 틀린 답이 나온다
- 🔴 **개수(탭 라벨)는 COUNT 쿼리로 미리 받아 즉시 표시한다** (`getBillCountsByMonaCd`).
  숫자까지 지연시키면 탭이 비어 보인다. ⚠️ COUNT 의 조건은 페이지 쿼리와 **같아야** 한다 —
  어긋나면 "전체 887" 이라 써놓고 넘기면 다른 수가 나온다
- 🔴 **정렬이 전건 쿼리와 같아야 한다** (`propose_dt DESC NULLS LAST, bill_id DESC`).
  다르면 페이지를 넘길 때 같은 법안이 다시 나오거나 건너뛴다
- 🔴 **`kind` 는 화이트리스트로만.** 모르는 값은 에러가 아니라 `'all'` 로 조용히 접는다
  (`/xray/chart` 와 같은 판단 — URL 을 손으로 고쳐도 안전하다). `ym` 은 `YYYY-MM` 정규식 통과 필수, 아니면 **400**
- ⚠️ **탭을 처음 열 때만** 로드한다 — 진입만 하고 안 여는 사람에겐 요청이 **0회**다. 같은 달 재클릭도 캐시로 0회
- ⚠️ **로딩·실패 상태를 반드시 그릴 것** — 빈 목록과 구분이 안 되면 "안 눌렸나" 가 된다
- ⚠️ JS 가 그리는 행은 서버 렌더와 **같은 임계값**을 써야 한다 (계류 일수 색 200/100일).
  다르면 같은 데이터가 자리에 따라 다른 색으로 나온다
- 실측: TTFB 0.18~0.31s · bills 페이지 응답 5.4KB · votes 한 달 응답 10.6KB

#### 표결 성향 카드 (`_vote_profile.ejs` · `.vp-*`, 2026-08-15 재구성)
**전체폭 2단** — 왼쪽 `어떻게 투표했나` / 오른쪽 `누구 법안에 찬성했나`. 구 `.cpv-*` 블록을 대체했다.
- 🔴 **자당/타당을 0~100% 막대 두 줄로 그리지 말 것.** 자당 100.0% vs 타당 98.2% 는 막대에서
  구분이 안 되고, **정작 핵심인 격차 1.8%p 가 안 보인다.** 두 값은 숫자 박스로 놓고 **격차만 눈금**으로 그린다
  - 눈금 상한 `GAP_MAX = 20`%p (실측 분포 -1.2~30.9, 10%p 이상이 10.9%뿐).
    넘는 값은 **막대만 꽉 채우고 숫자는 그대로** 쓴다 — 값을 숨기지 않는다
  - 마커(선+삼각캡+halo)는 **상임위 참여율 평균선과 같은 모양**이다. 한 사이트에서 기준선은 하나의 시각 언어
  - 🔴 **눈금 라벨은 가리키는 지점 바로 위/아래에 절대배치한다.** 중앙값 라벨을 footer 의
    `space-between` 가운데 칸에 뒀다가 지적받았다 — 마커가 17% 에 있어도 라벨은 **항상 50%** 자리에
    찍혀 서로 다른 값을 가리키는 것처럼 보였다
  - 🔴 **칠해진 구간에도 라벨을 붙인다** (`이 의원 4.6%p`). 없으면 "이 구간은 뭐지" 가 된다.
    끝점은 골드 점(`.vp-scale-dot`)으로 못박는다 — 어디까지가 이 의원인지가 명확해야 한다
  - 🔴 **이 의원은 위, 중앙값은 아래**로 층을 가른다. 같은 줄에 두면 값이 가까울 때 반드시 겹친다
    (실측 4.6 vs 3.4 는 눈금에서 6%p 차이)
  - ⚠️ **라벨 정렬 임계값 20%는 모바일 기준이다.** 375px 에서 눈금 폭이 약 280px, 라벨 절반이 약 44px 이라
    가운데 정렬을 20% 안쪽까지 허용하면 12px 여유가 남는다. 데스크톱(551px)만 보고 14 로 잡으면
    모바일에서 왼쪽으로 삐져나간다. **격차 1%p 미만이 266명 중 77명(29%)이라 왼쪽 끝은 다수 케이스다**
    - 정렬이 바뀌어도 가리키는 지점은 안 흔들린다 — 정확한 위치는 골드 점·삼각캡 마커가 잡고
      라벨은 **색으로** 그 둘에 묶인다 (골드 라벨↔골드 점 / 차콜 라벨↔차콜 마커)
- 🔴 **찬반은 누적 막대 한 줄**이다 (구 0~100% 막대 4줄). 찬성 98.3% 짜리 560px 막대는 길이에서 읽을 게 없다
  - ⚠️ `.vp-seg` 에 `min-width` 필수 — 0.6%(3건) 구간이 폭 0px 으로 사라진다
- 🔴 **찬성·반대·기권의 분모(536)와 불참의 분모(598)가 다르다.** 불참을 점선 아래로 내리고 분모를 각각 명시한다 —
  안 밝히면 "네 값을 더해도 100%가 안 되는데?" 가 된다. 원래도 그렇게 계산됐지만 화면이 말하지 않았다
- ⚠️ 초록·빨강은 **본회의 표결 결과(객관 데이터) 전용**이다. 자당/타당은 골드·무채색으로만 (정당색 금지)
- 🔴 **격차 구간(밴드)은 `utils/gapBands.js` 단일 소스다** (2026-08-15). `app.locals.GAP_BANDS` 로 주입되어
  **의원 목록의 격차 필터(`#pol-gap-filter`)와 상세의 격차 눈금이 같은 값을 쓴다** —
  어긋나면 상세는 "뚜렷한 편" 인데 목록 필터엔 안 잡히는 상황이 생기고, 사용자는 뭐가 틀렸는지 알 수 없다.
  목록의 `<option>` 도 이 배열에서 렌더된다 (숫자를 직접 쓰지 말 것)
  | 구간 | 범위 | 실측 인원(266명 중) |
  |---|---|---|
  | 법안 중심 | 0~2%p | 100 (37.6%) |
  | 중간 | 2~5%p | 75 (28.2%) |
  | 뚜렷한 편 | 5~10%p | 62 (23.3%) |
  | 매우 뚜렷 | 10%p 이상 | 29 (10.9%) |
  - 경계 2/5/10 은 2026-08-05 목록 필터 값을 승계한 것이다. 네 구간 모두 표본이 충분하니 옮기려면 실측부터
  - 🔴 **이름만 내지 말 것 — `meaning`·`sentence` 를 항상 같이 낸다.** 구간 이름 넷 중 의미를 담은 건
    `법안 중심` 하나뿐이고, 나머지 셋(`중간`·`뚜렷한 편`·`매우 뚜렷`)은 **세기만 말할 뿐 무엇이
    뚜렷한지를 말하지 않는다** (사용자 지적). 목록 필터는 select 가 `당 성향:` 이라 문맥이 잡히지만
    상세에는 그 문맥이 없다. 화면에서 세 겹으로 푼다:
    | 자리 | 내용 |
    |---|---|
    | 큰 숫자 옆 문장 | `자당 법안에 조금 더 찬성했습니다 (타당보다 4.6%p 높음)` — `band.sentence` |
    | 구간표 머리 | `당 성향의 세기 — 자당 법안을 타당 법안보다 얼마나 더 지지했는지` (`GAP_AXIS_LABEL`/`DESC`) |
    | 구간표 각 칸 | 이름 / 범위 / 뜻(`band.meaning`) 3줄 |
    - ⚠️ **음수 격차는 `sentence` 를 그대로 쓰면 거짓이 된다** (방향이 반대다) — 따로 문장을 쓴다
    - ⚠️ 구간표는 `repeat(auto-fit, minmax(118px, 1fr))` — 데스크톱 4열, 375px 에서 2열(149.5px)로
      알아서 접힌다. 하한 118px 은 최장 라벨 `뚜렷하게 더 찬성`(약 96px) + padding 기준
  - ⚠️ **구간 이름은 서술이지 평가가 아니다.** 다수당·소수당은 의사일정 구조가 달라 격차가 구조적으로
    다르게 나온다 — 좋다/나쁘다로 읽히는 말(성실·소신·거수기 등)을 절대 쓰지 말 것
  - ⚠️ 음수 격차(실측 12명)는 `법안 중심` 으로 접는다 — "타당 법안에 오히려 더 찬성" 도 '정당을 안 따랐다' 는 뜻이다
  - ⚠️ **구간 이름을 눈금 위 각 구간 가운데에 배치하지 말 것** — 375px 에서 첫 구간(0~2%p) 폭이 28px 뿐인데
    `법안 중심` 라벨이 52px 이라 반드시 겹친다. 눈금 아래 `.vp-bandkey` 목록으로 푼다
  - ⚠️ 현재 구간은 **색만으로 표시하지 말 것** — 이름이 전부 굵어 색차가 안 읽힌다. 테두리+옅은 배경까지 줄 것
  - ⚠️ 경계선(`.vp-scale-div`)에 흰색을 쓰면 골드 fill 위에서만 보이고 회색 track 위에서 사라진다 → `--border2`
- ⚠️ `자당/타당`·`격차`·`%p` 는 일상어가 아니라 각 패널 머리에 `.vp-lede` 설명 한 줄이 붙는다
- ⚠️ 1열 전환은 **900px** — 그 아래로 가면 패널당 400px 미만이 되어 `.vp-cmp` 2칸이 무너진다
- **월별 표결 참여 추이** (`.vp-trend`) — 왼쪽 패널의 남는 자리를 **같은 주제**로 채운 것이다 (2026-08-15)
  - 🔴 여기에 월별 **발의** 현황을 넣지 말 것. 크기는 맞지만(빈 공간 328px vs 카드 244px)
    ① "표결 성향" 카드 안에 발의 차트가 들어가 주제가 어긋나고
    ② **페이지 높이가 1px 도 안 줄어든다** — 3열 행 높이는 타임라인(449)이 정하므로 월별이 빠져도
       행은 449 그대로다. 빈 공간이 옮겨갈 뿐이다 (실측)
  - 🔴 **추가 쿼리 0** — `votes` 배열(표결 내역 탭용)이 이미 전건 로드돼 있어 뷰에서 접는다.
    `votes` 를 include 인자에 넘길 것
  - 🔴 **연도별로 끊는다** (2026-08-15). 표결이 있었던 달을 한 줄에 늘어놓으면 임기가 길어질수록
    막대가 얇아진다 — 22대는 2024-05~2028-05 라 **최대 48개월**이고 579px 패널에서 막대가 10px 이 된다.
    연도 탭으로 나누면 최대 12칸이라 **43px**(1280px 실측) 확보. 기본은 가장 최근 연도
    - 부수효과로 x축이 **진짜 달력**이 됐다 — 1~12월 슬롯이 고정이라 월 라벨을 쓸 수 있다.
      예전엔 "표결이 있었던 달의 순서" 라 축이 달력이 아니었다
    - ⚠️ 연도를 바꾸면 **열려 있던 달 패널을 닫는다.** 다른 해의 상세가 남으면 "이 막대를 눌렀나" 가 된다
  - 🔴 **표결이 없었던 달은 0으로 채우지 않는다 — 빈 칸으로 둔다.** 0% 막대(회색 트랙 가득 + 얇은 골드)와
    빈 칸(점선 baseline 만)은 **반드시 달라 보여야 한다**:
    `0%` = 나왔어야 하는데 안 나왔다 / `빈 칸` = 본회의 표결 자체가 없었다.
    실측 대비: 김윤덕(장관) 2026년 1~7월은 0% 막대, 8~12월은 빈 칸 — 화면에서 확실히 갈린다
  - ⚠️ 막대에 `min-height 2%` — 0%인 달(장관 취임 후 등)이 아예 안 그려지면 데이터가 빠진 것처럼 보인다
  - ⚠️ 표결월 4개 미만이면 그리지 않는다 (중도 합류자 — 추이라고 부를 게 없다)
  - 🔴 **정보가 되는 근거 — 장관·중도합류를 뺀 일반 의원 273명만 봐도 결론이 같다** (2026-08-15 재실측.
    처음 근거로 든 "304/305명" 은 장관·중도합류에 쏠린 값이라 다시 쟀다):
    | | |
    |---|---|
    | 참여율 100%인 달 | **46.9%** — 절반이 안 된다 |
    | **50% 미만인 달** | **22.6%** — 5달 중 1달 이상 |
    | 월별 최대−최소 차이 | **중앙값 100.0%p** (절반 이상이 0%인 달과 100%인 달을 둘 다 갖는다) |
    | 거의 평평(20%p 미만) | 273명 중 **20명(7%)** 뿐 |
    → "매달 비슷하게 참여한다" 는 통념과 반대다. 이 차트는 실제로 갈리는 것을 보여준다
  - 🔴 **`title` 속성(브라우저 기본 툴팁)에 기대지 말 것** — 뜨는 데 1초 가까이 걸리고 안 뜨는 경우도 잦다
    (사용자 지적). 막대는 `<button>` 이고 **클릭하면 그 달의 상세 패널**이 아래에 열린다
    - 🔴 호버 툴팁이면 **패널 안의 법안 링크를 누를 수 없다** (마우스를 옮기는 순간 사라진다).
      이게 클릭 방식이어야 하는 결정적 이유다
    - 패널 내용: `표결 N건 중 M건 참여 (P%)` · **결과별 필터 칩** · **법안 목록(링크)** · **페이징**
    - 🔴 **네 결과(찬성·반대·기권·불참)를 다 담는다.** 처음엔 반대·기권만 담았는데 찬성·불참도
      "그 달에 무슨 법안이 있었나" 를 알려면 필요하다 (사용자 지적). 많으면 페이징(10건/쪽)으로 접는다 —
      **잘라내면 그 질문에 답을 못 한다.** 실측 한 달 최대 70건 · 95분위 51건 · 평균 26건
    - ⚠️ **결과별 필터 칩이 없으면 70건에서 반대 2건을 찾으려 페이지를 다 넘겨야 한다.**
      0건인 결과는 칩을 그리지 않는다 (누를 수 없는 칩은 노이즈다)
    - ⚠️ 법안 목록은 **클릭할 때 API 로** 가져온다 (`?ym=YYYY-MM`). 전건을 JSON 으로 심었을 땐 75KB 였다 —
      실제로 보는 건 클릭한 달 하나뿐이다. 미리 심는 건 막대·칩용 **요약 숫자만** (23개월 ≈ 2KB)
    - ⚠️ 법안명이 그대로 들어가므로 `JSON.stringify(...).replace(/</g, '\\u003c')` + JS 쪽 `esc()` 이중 방어
    - 🔴 **"막대를 클릭하면…" 안내에만 기대지 말 것 — 진입 시 가장 최근 달을 미리 선택해 둔다** (2026-08-16).
      구조가 이랬다: `lede → 차트 → foot → note → note → 상세상자(안내문)`.
      **안내가 차트에서 설명 문단 두 개를 지난 다섯 줄 아래**에 있었고, 게다가 `10.5px`·`--sub2`(대비 3.95)로
      **그 패널에서 가장 작고 가장 옅은 글자**였다 (사용자 지적: "클릭까지 실제로 도달할지 의문").
      스타일보다 **위치**가 먼저였고, 근본적으로는 말로 알리는 것보다 **결과를 한 번 보여주는 편**이 세다
      - 🔴 **요청은 여전히 0회다.** 요약(`tot`/`att`/`rate`)이 `window.__VOTE_MONTHS__` 에 이미 있어
        `preview(ym)` 이 로컬로 그린다. API 는 `법안 N건 보기 →`(`.vtd-open`) 나 막대를 실제로 누를 때만
      - 🔴 **미리보기에 결과별 칩을 같이 그리지 말 것** — 목록이 없는데 필터 칩만 있으면 눌러도 아무 일이 없다.
        미리보기는 `요약 한 줄 + CTA 버튼` 까지다
      - 🔴 **연도 탭을 바꿀 때 빈 힌트로 되돌리지 말 것** — 그 해의 마지막 달로 **다시 미리보기**한다.
        안 그러면 없애려던 그 빈 상태가 연도를 바꿀 때마다 되살아난다
      - 🔴 **막대의 링(`[aria-pressed="true"]`)이 막대↔상세상자를 잇는 유일한 신호다.**
        hover 는 터치에 없어 affordance 로 못 쓴다
      - 미리보기 대상은 **화면에 실제로 그려진 막대**에서 뽑는다 (`latestOf`). `data` 키를 직접 훑으면
        숨은 연도의 달이 잡힌다
      - lede 에도 한 문장을 넣었다 (`막대를 누르면 … 아래에 열립니다`) — CTA 가 안 보이는 폴백 경로용
      - ⚠️ 상세 상자의 `.vp-trend-hint` 는 이제 **JS 실패 시 폴백**이다 (SSR 기본값). 정상 경로에선 즉시 교체된다
  - ⚠️ **축 눈금(0/50/100%)을 반드시 붙일 것** — 막대 높이가 무슨 값인지 알 수 없다는 지적.
    50% 지점에는 가로 점선도 같이 (숫자만 있으면 어디가 그 높이인지 모른다)
  - 🔴 **찬성·반대·기권을 월별 누적 막대로 쌓지 말 것.** 반대·기권은 너무 희소하다 —
    **달의 77.1%가 0건**, 달 평균 **0.53건**. 99% 찬성인 막대에 실 한 올로 묻힌다.
    대신 **있었던 달만 점(`.vp-trend-dot`)으로** 표시한다 — 희소하기 때문에 오히려 시점이 신호가 된다
    (반대·기권이 있는 달 수: 중앙값 5개월 · 최대 19개월 → 점 밀도가 적당하다).
    찬성/반대/기권/불참 내역은 막대 **툴팁**에 담는다
  - ⚠️ 반대·기권이 0건인 의원(실측 25명)은 점줄·문구를 아예 안 그린다 — 없는 걸 설명하면 노이즈다
  - 🔴 **점 줄(`.vp-trend-dots`)은 반드시 `.vp-trend-plot` 안에 둘 것.** 밖에 두면 축 라벨 자리
    (`padding-left: 30px`)를 못 받아 **막대만 30px 밀려 점과 어긋난다** (실제로 그렇게 나갔다).
    같은 부모 · 같은 flex gap 이어야 열이 맞는다 (검증: 23쌍 최대 오차 0px)
- 🔴 **`기권`과 `불참`은 다르다** — 원천이 네 값으로 구분해 준다 (실측 찬성 129,802 · 불참 43,871 ·
  기권 2,412 · 반대 1,175). `기권` = 표결에 참여해 찬반 어느 쪽도 안 택함, `불참` = 그 표결에 참여 안 함.
  용어를 안 풀면 같은 말로 읽히므로 화면에 한 줄로 설명한다
  - ⚠️ 결과 배지 색: 찬성 초록 · 반대 빨강(**객관 데이터라 허용**) / 기권 골드 · 불참 무채색
    (입장이 아니라 상태라 색을 안 준다)
- 🔴 **`vs`·`vsTotal`·`vsAttended`·`nf` 를 include 에 명시적으로 넘길 것.** 부모의 지역 `const` 라
  EJS include 가 물려받지 못한다 (그냥 include 하면 ReferenceError — 실제로 500 을 냈다).
  `crossPartyVote` 는 컨트롤러 locals 라 자동으로 보인다

  - ⚠️ **남은 세 장이 3열인 이유는 2열에 3장이 안 맞아서다.** 한 장이 통째로 전체폭 행을 먹으면
    페이지가 **342px 길어진다** (실측). 3열로 묶으면 2,886 → **2,466px** 로, 개편 전(2,486)보다도 짧다.
    월별 발의가 12개월 막대라 제일 넓은 칸(1.3fr)을 갖는다
  - 🔴 **활동 레이더(4축 다이아몬드)를 되살리지 말 것** (2026-08-15 삭제). 4축이
    `발의 / 공동발의 / 표결참여 / 가결율` 로 **KPI 행과 같은 숫자**였고, 앞 두 축은 현역 p90 대비
    백분율인데 뒤 두 축은 원값 % 라 **단위가 다른 값을 한 도형에 그린** 셈이라 다각형의 모양·면적에
    읽을 정보가 없었다. 스케일용 p90 쿼리(`getRadarScale`)도 같이 제거 — 상세 진입마다 돌던 쿼리 하나가 사라졌다
  - ⚠️ ≤768px 은 KPI 2×2. 4칸을 한 줄로 두면 칸당 84px 이라 `표결 참여율` 라벨이 세 줄로 깨진다
  - 🔴 **그 미디어 쿼리는 베이스 규칙 *뒤*에 둘 것.** 위쪽 768 블록에 넣었다가 같은 특이도에서
    나중 규칙(`repeat(4,1fr)`)이 이겨 **모바일에서 4칸이 그대로 화면 밖으로 나갔다** (375px 실측). 파일 순서가 곧 우선순위다

#### KPI 백분위 (`.kpi-rank` · `getKpiPercentiles.sql`, 2026-08-15)
카드가 "숫자 하나 + 라벨" 뿐이라 크기에 비해 내용이 없었다. 백분위 막대 + `상위 N%` 가 그 자리를 채운다.

| 지표 | 코호트 | 제외 |
|---|---|---|
| 법안 발의 | 현직 · 비국무위원 · **임기 90%+ 재직** (실측 272명) | 퇴임 · 국무위원 · 임기 중 합류 |
| 공동발의 | 위와 동일 | 위와 동일 |
| 표결 참여율 | 현직 · 비국무위원 · **비의장단** · 표결모수 100+ (274명) | 퇴임 · 국무위원 · 의장단 · 표결기록 없음 |
| **가결율** | — | **전원 (백분위 자체를 안 만든다)** |

- 🔴 **가결율에 백분위를 붙이지 말 것.** 실측 근거가 명확하다:
  ① 가결 0건이 **94명(32%)** 이라 셋 중 하나가 통째로 최하위로 묶인다
  ② 같은 "가결 1건" 인데 백분위가 **32~93** 으로 흩어진다 (11건 중 1건 = 9.1% → 93분위 /
     110건 중 1건 = 0.9% → 32분위) — **많이 낸 사람이 벌을 받는다**
  ③ 최댓값이 26.1%. 계류가 76%라 이 지표는 사실상 "얼마나 오래전에 냈나" 를 잰다
  → 중앙값(2.5%)만 앵커로 병기하고 `계류 76%라 순위 없음` 이라고 이유를 쓴다
- 🔴 **국무위원 겸직(7명)은 3지표 전부 제외.** 실측 발의 27(일반 60) · 공동 458(713) · 표결참여 40.0%(76.8%) —
  셋 다 절반 수준이다. 부처를 맡으면 의정활동이 주는 게 당연한데 백분위를 붙이면 장관 전원이 하위권이 된다
  - **값은 숨기지 않는다** — 사실이고, 숨기면 왜 없는지 설명할 수 없다 (발언기록 `offDuty` 와 같은 판단)
- 🔴 **의장단(3명)은 표결참여율만 제외.** 발의 65·공동 820 으로 오히려 평균 위다. 표결참여만 68.7%인데
  국회의장은 **관례상 본회의 표결에 불참(중립)** 하기 때문이다. 이건 게으름이 아니라 역할이다
- 🔴 **`bill_votes` 모수가 곧 재직 기간의 대리 지표다.** "그 사람이 재직 중일 때 본회의에 올라온 법안 수" 라서다.
  실측이 교과서적으로 갈린다 — 모수 598 → 279명(첫 발의 2024-05~11) / 모수 0·164·330·348·511 → 20명
  (첫 발의 2026-06~08 · 2026-07 · 2025-09 · 2025-08 · 2025-02). **모수와 첫 발의일이 정확히 대응한다.**
  지난달 들어와 2건 낸 사람을 임기 전체 재직자와 나란히 세우면 "하위 1%" 가 되는데 그건 재직 기간이다
  - 기준선은 **상수로 박지 않는다** (`MAX(vote_tot) * 0.9`) — 회기가 갈수록 늘어난다
  - ⚠️ **표결참여율에는 이 제외를 적용하지 않는다** — 비율이라 분모가 자기 재직 기간이다 (기간 보정이 이미 돼 있다)
- ⚠️ **제외 사유는 문자열이다** (`'국무위원 겸직'`·`'임기 종료'`·`'의장단'`·`'임기 중 합류'`·`'표결 기록 부족'`).
  불리언으로 뭉치면 화면이 이유를 못 써서 "왜 나만 순위가 없지" 가 고장으로 읽힌다
  - ⚠️ 조사는 **받침을 봐야 한다** — 안 하면 `임기 종료이라`·`임기 중 합류이라` 가 나간다 (실제로 그렇게 렌더됐다).
    `(코드 - 0xAC00) % 28 !== 0` 이면 받침 있음 → `이라`, 없으면 `라`
- ⚠️ **항상 "상위 N%" 로 쓰지 말 것** — 최하위가 **"상위 100%"** 가 되어 정반대로 읽힌다.
  절반을 기준으로 뒤집는다 (pr=0 → `하위 1%` / pr=1 → `상위 1%`)
- ⚠️ **정당색 금지.** 상위=초록/하위=빨강으로 가르는 순간 성적표가 된다. 골드 단색 + 막대 길이로만
- 🔴 **`.kpi-caveat` 한 줄은 백분위의 전제다.** 빼면 "장관은 왜 순위가 없지" 가 고장으로 읽힌다
- 🔴 **큰 숫자 옆에 `.profile-kpi-frac` 한 줄을 둔다 — 숫자만으로는 안 읽힌다.**
  이 사이트의 데이터는 상식으로 해석되지 않으므로 **모두가 알 것이라 가정하지 말고 친절하게** 쓴다
  (2026-08-15 사용자 방침). 카드별로:
  | 카드 | frac | 뜻 |
  |---|---|---|
  | 법안 발의 | `대표로 낸 법안` | 무엇을 센 건지 (`87` 만으로는 대표/전체 구분 불가) |
  | 공동발의 | `이름을 올린 법안` | 무엇을 센 건지 (대표 비중은 아래 전용 줄) |
  | 표결 참여율 | `598건 중 536건 참여` | 그 %의 계산식 |
  | 가결율 | `87건 중 6건 가결` | 그 %의 계산식 |
  - 🔴 **`536/598` 처럼 숫자만 두지 말 것** — 앞뒤가 뭔지 알 수 없다 (사용자 지적).
    `598건 중 536건 참여` 처럼 **의미를 같이** 쓴다
  - 🔴 **대표발의 비중은 `.profile-kpi-lead` 전용 줄이다** (`발의 885건 중 87건이 대표 9.8%`).
    frac 슬롯에 넣지 말 것 — `885건 중 87건` 까지 쓰면 146px 인데 375px 2열 카드 내부는 111px 뿐이다 (실측).
    전용 줄이라야 "몇 건 중 몇 건 · 비중 얼마" 를 온전히 쓸 수 있다
    - ⚠️ 위 중앙값 줄과 **주어가 다르므로 점선 구분선**을 둔다. 안 두면 중앙값에 딸린 것으로 읽힌다
    - ⚠️ **분모는 공동발의 798 이 아니라 대표+공동 전체(885)** 다. 그래서 `이 중 대표는 9.8%` 같은
      지시어를 쓰지 않는다 — "이 중" 이 798 을 가리키는 것으로 읽힌다 (실제로 그렇게 썼다가 고쳤다)
  - ⚠️ **`건 · 대표로 낸 법안` 처럼 단위를 앞에 붙이지 말 것** — 모바일에선 이 덩어리가 통째로 아랫줄로
    내려가 `건` 이 숫자와 떨어진다. 단위는 중앙값 줄(`의원 중앙값 56건`)이 알려준다
  - ⚠️ frac 은 산문이라 **mono 를 쓰지 않는다** (JetBrains Mono 는 한글 글리프가 없어 폴백된다).
    `white-space: nowrap` 으로 내부 분리를 막고, 줄바꿈은 `.profile-kpi-top` 의 flex-wrap 이 덩어리째 처리한다
  - 실측 텍스트 폭(12px): `598건 중 536건 참여` 103px · `87건 중 6건 가결` 83px · `대표 비중 9.8%` 77px.
    375px 2열의 카드 내부는 **111px** 이라 전부 들어간다 — 문구를 늘릴 땐 이 폭을 먼저 잴 것
- 🔴 **`.kpi-caveat` 는 용어 사전을 겸한다** — 대표발의·공동발의·가결율·대표 비중이 각각 무엇인지 3줄로 쓴다.
  `대표 비중` 은 혼자로는 뜻이 없어 **의원 중앙값(8.0%)을 반드시 같이** 낸다 (평균선 없는 막대와 같은 문제)
  - ⚠️ **본인 수치와 코호트 중앙값을 한 줄에 `·` 로 붙이지 말 것.** `중앙값 2.5% · 10/222` 로 내보냈다가
    "중앙값 뒤 숫자가 뭐냐" 는 지적을 받았다 — 뒤 숫자는 본인의 가결 10 / 발의 222 인데 중앙값에 딸린 것으로 읽힌다.
    지금은 본인 수치는 큰 숫자 옆, 중앙값은 `.is-med`(opacity 0.78) 줄에 따로 둔다
  - ⚠️ `.profile-kpi-top` 에 **`flex-wrap` 필수** — 좁은 폭에서 `90% 536/598` 이 안 들어가면 접혀서
    큰 숫자 바로 아랫줄로 떨어진다 (그래도 붙어 읽힌다). 안 접으면 카드를 삐져나간다
  - 카운트 카드(발의·공동발의)에는 분모가 없어 이 줄이 없다 — 비율과 카운트는 원래 다른 것이라 맞추지 말 것
- **성능**: 쿼리가 **코호트 전체(309행)를 한 번에** 낸다. 서비스가 **10분 메모리 캐시 + inflight 공유**로
  들고 `mona_cd` 로 찾는다 — 의원마다 돌리지 않는다
  - ⚠️ **상관 서브쿼리로 쓰면 309번씩 돌아 1,483ms 였다.** 테이블당 1회 집계 후 조인이 필수 (695ms)
  - 실측: 페이지 7회 로드에 쿼리 **1회**. 콜드 TTFB 1.51s → 워밍 **0.22~0.44s**
  - ⚠️ 실패해도 **null 을 돌려 페이지는 살린다** — 백분위는 부가 정보라 이것 때문에 상세가 500 이 나면 안 된다
  - ⚠️ `politician_titles` 는 수동 관리라 비어 있을 수 있다. 그 경우 EXISTS 가 전부 FALSE 라
    **"제외 없음" 으로 안전하게 무너진다** (조용히 틀리지 않는다)

#### 정당별 공동발의 협력 (`_party_coop.ejs` · `.pc-*`/`.party-coop-*`, 2026-08-15)
**전체폭 2단** — 왼쪽 `내가 참여한 법안` / 오른쪽 `내 법안에 참여한 의원`.
- 🔴 **왼쪽(내가 참여한)이 먼저다.** 여긴 의원 **상세** 페이지라 "내 법안에 누가 합류했나"(받은 것)보다
  "내가 어느 당 법안에 합류했나"(**본인의 선택**)가 이 사람을 설명하는 데 더 가깝다 (사용자 지적).
  둘은 다른 질문이라 어느 하나로 대체되지 않으므로 나란히 낸다 — 순서를 바꾸지 말 것
  - 실측(강경숙)이 실제로 갈린다: 내가 참여할 땐 타당 **38.0%** / 내 법안에 받은 건 타당 **31.8%**
- 🔴 **두 패널은 세는 단위가 다르다.** 섞어 쓰면 합계가 왜 다른지 설명이 안 된다:
  | | 단위 | 실측(강경숙) |
  |---|---|---|
  | 내가 참여한 | 법안 **건수** (한 법안에 한 번) | 798건 = 공동발의 건수와 정확히 일치 |
  | 내 법안에 | (법안 × 의원) **쌍의 횟수** | 976회 |
- 🔴 **정당색을 쓰지 말 것** (2026-08-15 제거). 이름·막대에 `partyColorOf()` 를 그대로 뿌려 보라·파랑이
  나가고 있었다 — 중립성 원칙과 정면 충돌. 강조는 **자당(골드) / 타당(무채색)** 로만
  (정당을 가르는 게 아니라 **관계**를 가르는 것이라 이 대비는 허용된다)
- 🔴 **분모는 전체다.** 예전엔 상위 4개만 표시하면서 **그 4개의 합을 100%로 삼아** 비율이 부풀어 있었다
  (실측 강경숙 1위 70.0% → 실제 68.2%). 정당이 5개 이상인 의원이 315명 중 **179명(57%)** 이라 대부분 영향
  - 잘린 나머지는 `그 외 N개 정당` 한 줄로 반드시 보여준다 — 없으면 비율 합이 100%가 안 되는 이유를 알 수 없다
- 🔴 **폴백 라벨은 `명부 없음`** (구 `기타/무소속`). 실제 정당인 `무소속` 과 나란히 떠서 구분이 안 됐다
  (실측 강경숙: 명부 없음 44 / 무소속 11 — 둘 다 존재). `/xray/chart` 와 같은 판단
- 🔴 **무소속(실측 8명)은 자당/타당으로 나누지 않는다.** "자당" 이 정당이 아니라 그냥 다른 무소속 의원이라
  타당 99%가 나오는데 그건 초당적이라는 뜻이 아니라 **소속이 없다는 뜻**이다
- ⚠️ 두 패널을 **같은 함수(`_panel`)로 그린다** — 규칙이 갈리면 나란히 놓은 의미가 없어진다
- ⚠️ 자당 비중은 정당 크기에 좌우된다 (실측 민주 90.5% · 조국혁신 62.0%). 화면에 한계를 같이 쓸 것
- ⚠️ 1열 전환은 `.vp-grid` 와 **같은 900px** — 한 페이지에서 "두 질문을 나란히" 는 하나의 패턴이어야 한다
- ⚠️ 한쪽 데이터가 없으면(대표발의 0건 등) 빈 칸이 아니라 **사유를 쓴다**
- ⚠️ `partyCoop`·`partyCoopOut`·`nf` 를 include 에 명시적으로 넘길 것 (nf 는 부모의 지역 const)

#### 히어로 우측 「나와의 성향 일치」 (`_profile_vs.ejs` · `.profile-vs`/`.pv-*`, 2026-08-15)
D 레이어 본체. **분석 탭 본문의 전체폭 접힘 띠(`bg-vs-collapsible`)를 대체한 것이다 — 둘 다 두지 말 것.**
- 왜 옮겼나: ① 히어로 우측이 통째로 비어 있었다 ② "이 사람이 나와 얼마나 맞나" 는 지역구·선수와
  같은 급의 **정체 정보**라 프로필 옆이 제자리다 ③ 옛 띠는 가로를 다 먹으면서 세로도 **439px** 를 썼다
  → 완료 유저 기준 문서 높이 **약 240px 감소**, 게다가 정보가 스크롤 없이 보인다
- **히어로에 있으니 모든 탭에서 보인다** — 탭은 "무엇을 했나" 의 분류지 이 사람이 누구인지와 무관하다
- 🔴 **접기/펼치기를 되살리지 말 것.** 폭 320px 안에 다 들어가 접을 이유가 없고, 접힘 상태가 곧
  "일치도 한 줄" 이라 예전 구조는 같은 정보를 두 번 그리고 있었다
- 상태 3종: 완료(일치도 % + 다이아몬드 + 축별 해석 4줄) / 미진단(진단 CTA) / 좌표 미산출(사유)
  - ⚠️ 미진단·미산출은 `align-self: center` — stretch 로 두면 3줄짜리가 프로필 높이(241px)까지 늘어나
    **거대한 빈 점선 상자**가 된다
- ⚠️ **다이아몬드 viewBox 는 가로로 넓다** (`300 × 210`, 도형은 가운데). 정사각으로 두면 좌우 축 라벨이
  잘린다 — `사회·문화` 5글자가 앵커에서 왼쪽으로 ~47 뻗는데 `cx-R-8 = 23` 이라 음수 좌표로 넘어갔다 (실측)
- 🔴 **`.pv-cap` 에 mono 폰트 + 넓은 자간을 쓰지 말 것.** JetBrains Mono 는 한글 글리프가 없어 폴백되는데
  letter-spacing 까지 겹치면 `나와의  성향  일치` 로 흩어져 거의 안 읽힌다
  (`/xray/chart` 의 `.ch-label` 에서 이미 겪은 것과 같은 함정)
- ⚠️ **미진단 문구에 `<br>` 을 넣고 가로 배치에서 CSS 로 숨기지 말 것** — 두 줄이 공백 없이 붙는다
  (`성향을 진단하면강경숙 의원과`). `keep-all` + 폭 제한으로 자연 줄바꿈에 맡긴다
- 반응형 3단: **≥1200** 우측 320px 세로 / **769~1199** 히어로 전체폭 아래로 내려 **가로로 눕힘**
  (`.pv-main` 래퍼가 그것 때문에 있다) / **≤768** 다시 세로 스택
  - ⚠️ 769~1199 에서 세로 스택 그대로 내리면 히어로가 통째로 340px 길어진다.
    이 구간에 우측 320px 을 유지하면 가운데 칸이 353px 까지 좁아져 이름·위원회 칩이 무너진다
- ⚠️ 정당색 금지 — 나=골드 채움 / 의원=무채색 점선. `.bg-vs-fill-*`·`.bg-vs-dot-*` 는 그 규칙을 두 곳에서
  따로 정의하지 않으려고 **도형 스타일만 남겨둔 것**이다 (띠 자체는 삭제됨)
- 실측 (2026-08-15): 375·768·900·1024·1100·1280·1440px **가로 오버플로 0**.
  최악 케이스(위원회 6개 + 공백 없는 50자 특위명)도 히어로 379px 로 수용, 칩 잘림 0

#### 특수 직위 배지 (`.profile-title-badge`, 2026-08-12 추가)
이름·정당 배지 옆. `politician_titles` 테이블 — **전부 수동 관리**. 한 사람이 여러 개를 갖는다.
- 값 입력은 `ddl/seeds/politician_titles.sql` (초안 + 확인 절차 포함)
- category 4종 고정: `의장단` → `국무위원` → `교섭단체` → `당직` (표시 순서도 이 순서 = 공적 지위 → 정당 지위)
- 당직은 회색 외곽선으로 한 단계 낮춘다. ⚠️ **당직 배지에 정당색을 쓰지 말 것** — 바로 옆 정당 배지가 이미 그 신호를 주고 있어 두 번 반복된다
- ⚠️ **상임위원장·간사·위원은 여기 넣지 말 것.** `politician_committees` 가 API 로 자동 수집한다 (위원장 21 · 간사 39 · 위원 417). 중복 입력하면 화면에 두 번 나온다
- ⚠️ 시드가 `DELETE` 로 시작하는 이유 — 직위는 교체되는 것이지 누적되지 않는다. 전임자를 안 지우면 **의장이 두 명으로 보인다**

**왜 컬럼이 아니라 테이블인가**: 처음엔 `politicians.special_title` 컬럼으로 만들었다가 같은 날 바꿨다.
한 사람이 여러 직위를 동시에 갖기 때문 (정책위의장 겸 최고위원, 관례상 여당 원내대표가 국회운영위원장 겸임).

**🔴 왜 수동인가 — 자동 수집 경로가 아예 없다.** 소관 기관이 흩어져 있어서다:

| 직위 | 정하는 곳 | 국회 API |
|---|---|---|
| 상임위원장·간사·위원 | 국회 원구성 | ✅ `politician_committees` |
| 의장·부의장 | 국회 본회의 | △ `역대 국회의장단` 은 **연혁용**이라 현직이 늦다 (조정식 없음) |
| 원내대표 | 정당 의원총회 | ❌ |
| 당대표·최고위원·사무총장·정책위의장 | 정당 전당대회 | ❌ (정당법 소관) |
| 국무총리·장관 | 대통령 임명 | ❌ (행정부) |

열린국회정보는 국회사무처 보유 정보를 공개하는 창구다. 뒤의 셋은 **국회가 데이터 주인이 아니라** 줄 수가 없다.
공공데이터포털에도 현직 장관 명단 API 는 없다 (정부24 조직도는 페이지지 데이터셋이 아니다).

- ⚠️ **발언영상 API 로 자동 추출하는 안은 기각했다.** `ESSENTIAL_PERSON` 에 `조정식 국회의장` 처럼 찍혀서 실제로 의장 교체와 장관 7명을 찾아냈지만: 발언을 해야 잡히고(후반기 부의장 박덕흠 2건·남인순 1건 누락), MONA_CD 가 없어 이름 매칭이며, 임기가 아니라 "최근 발언일" 이고, 원구성 임시의장 사회를 본 주호영이 `국회의장` 3건으로 잡히는 노이즈가 있다. 10~40건짜리를 위해 감수할 오차가 아니다
- 활동량 지표를 만들 때 **장관 겸직자는 반드시 보정**할 것 — 상임위 활동이 줄어드는 게 당연한데 "게으름" 으로 읽히면 안 된다

**관리 화면 `/admin/titles`** (2026-08-12) — SQL 없이 직위를 넣고 고친다.
- 인증: `requireAdmin` (env `ADMIN_EMAILS` 이메일 허용목록). ⚠️ 권한 없으면 **403 이 아니라 404** — 403 은 관리자 페이지의 존재를 알려준다
- ⚠️ **카카오 계정은 이메일이 NULL 이라 못 들어간다.** 구글로 로그인할 것
- 쓰기에 `sameOrigin` 미들웨어 (세션 쿠키가 `sameSite:'lax'` 라 기본 방어는 되지만 관리자 쓰기는 피해가 커 한 겹 더)
- PRG 패턴 — 결과를 쿼리스트링으로 넘기고 리다이렉트. 새로고침 시 중복 INSERT 방지
- 폼 기반이라 **JS 없이 동작**한다 (그래서 DELETE/PUT 대신 POST)
- 🔴 **의원 목록을 select 마다 렌더하지 말 것.** 299명 × select 15개 = **546KB** 였다 (실측).
  `<template>` 에 한 번만 싣고 JS 가 복제해 채운다 → 1/15. JS 실패 시엔 각 select 가 "현재 값" 하나만 갖고 있어 화면은 멀쩡하고 사람 변경만 안 된다
- 상임위 직위는 **읽기 전용 안내로만** 표시 — 고쳐도 다음 배치에 덮인다

**운영 — `review_after` 로 관리한다 (상시 모니터링 X)**
직위 교체는 **대부분 시점을 미리 안다.** 그래서 값을 넣을 때 "다음에 언제 확인할지" 를 같이 적어두고,
배치가 때가 됐을 때 알려주게 한다. **모니터링을 기억이 아니라 데이터로 옮기는 것.**

| 직위 | 주기 | `review_after` 기준 |
|---|---|---|
| 상임위원장·간사·위원 | — | **자동** (`syncCommittees`, 손댈 것 없음) |
| 의장단 | 2년 (원구성) | 임기 만료 직전 (후반기는 2028-05) |
| 원내대표 | 1년 관례 | 선출 +1년 (민주 05월경 · 국힘 08월경) |
| 당대표 | 2년 임기지만 사퇴 잦음 | 전당대회 **다음 날** |
| 장관 | 개각 — 예측 불가 | 일괄 **3개월 뒤** |

`syncCommittees.js` 끝의 `checkStaleTitles()` 가 매일 확인해서 로그로 알린다:
- `review_after` 지난 직위 → `⚠ 재확인할 직위 N건` + 이름·직위·예정일
- **30일 안에 다가오는 것** → `[직위] 곧 확인: 한병도 · 당대표 직무대행 (2026-08-18)` (캘린더를 따로 안 봐도 되게)
- `source_url` 없는 직위, 테이블이 빈 경우
- ⚠️ `review_after` 가 NULL 이면 `updated_at + 6개월` 로 **폴백**한다 — 빠뜨린 행이 감시에서 통째로 빠지지 않도록. 다만 6개월은 개각 주기보다 길어 장관에는 부적합하니 명시할 것
- ⚠️ **`updated_at` 은 백데이팅이 안 된다** (`trg_politician_titles_updated_at` 트리거가 매 UPDATE 마다 NOW() 로 덮는다). 폴백 경로를 테스트하려면 값을 조작하지 말고 식을 직접 확인할 것
- ⚠️ 점검 쿼리에서 컬럼은 **반드시 별칭으로 한정**할 것 — `politicians` 에도 `updated_at` 이 있어 조인 시 `ambiguous` 로 죽는다 (실제로 겪음)
- ⚠️ 점검이 실패해도 **배치를 실패시키지 않는다** (try/catch). 명단 동기화가 본업이고 이건 부가 점검이다
- 외부 호출도 파싱도 없어 정확도 리스크가 0이다
- ⚠️ **네이버 등 포털 검색으로 값을 자동 수집하는 안은 기각했다**: ① 브리핑에서 세운 "뉴스는 검색 링크만, 기사 수집 안 함" 원칙과 충돌 ② 검색결과 크롤링은 약관·robots.txt 위반이고 공식 검색 API 는 문서 목록만 준다 ③ 뉴스 텍스트엔 "전 법무부 장관"·"당시 원내대표" 처럼 **과거 직위가 섞여** 발언 추출보다 정확도가 더 나쁘다 ④ `syncPoliticians` 는 체인 맨 앞이라 외부 호출을 넣으면 포털 장애 시 워치독이 죽여 **그날 전체 배치가 멈춘다**

**유통기한이 있는 값** (2026-08-12 입력분): 민주당 당대표는 정청래 사퇴(06-24)로 공석이고 한병도 원내대표가 직무대행 —
**08-17 전당대회 직후 반드시 갱신**할 것. 국민의힘 원내대표 정점식도 08-10 선출이라 갓 바뀐 값이다.

#### 소속 위원회 칩 (`.profile-cmt`, 2026-08-12 추가)
히어로의 지역구·선수 메타 **바로 아래**. 위원회는 의원이 실제로 일하는 자리라 지역구·선수와 같은 급의 정체 정보로 다룬다.
- 쿼리 `getCommittees.sql` — 상임위 먼저 → 직위순(위원장·간사·위원) → 이름순
- **직위로만 강조한다** (정당색 배제): 위원장·간사는 골드 칩 + 역할 배지, 위원은 무채색. 특위는 점선(한시 조직)
- 링크: 상임위 칩 → `/bill?committee=<name>`. ⚠️ **`is_special` 로 링크 여부를 판정하지 말 것** — `EXISTS(bills.committee = dept_nm)` 로 실제 존재를 확인한다. 실측 23개 중 19개가 매칭되는데 그 경계가 특위 여부와 정확히 겹치지 않는다 (`기후위기 특별위원회`는 특위인데 법안이 있다). 링크했는데 0건 페이지로 보내는 게 최악
- 🔴 **`overflow-wrap: anywhere` 필수.** 특위 중에 **공백이 하나도 없는 50자 이름**이 있다 (`제9회전국동시지방선거투표용지부족사태등…국정조사특별위원회`). `word-break: keep-all` 만 두면 375px 에서 `scrollWidth 581 / clientWidth 325` 로 **잘려서 안 보인다.** 문서 가로 스크롤은 안 생겨서 눈치채기 어렵다 — `bill_detail` 의 `.tl-label` 과 완전히 같은 함정
- 미소속 11명은 블록 자체가 렌더되지 않음

#### 회의 발언 기록 (`#speech-record` / `.sp-*`, 2026-08-15)
분석 탭 **맨 아래** 전체폭 카드. 소스는 `politician_speeches`.
발의·표결 지표가 전부 본회의·법안 기준이라 안 보이던 **상임위**를 메우는 자리다.

- 배선: 쿼리 3개 — `getSpeechSummaryByMonaCd.sql`(요약 + 회의종류 분포를 한 쿼리로) ·
  `getSpeechMeetingsByMonaCd.sql`(회의 목록 전체) · `getSpeechRatesByMonaCd.sql`(참여율 + 코호트 평균, MV 를 읽는다)
  → `PoliticianService.getSpeechesByMonaCd()` 가 셋을 병렬로 받아 모양을 잡는다. 발언 0건이면 **`null` 을 돌려 뷰가 섹션을 안 그린다**
- 🔴 **세 쿼리의 `role_kind` 필터가 같아야 한다** (`IN ('member','chair')`). 어긋나면 "질의석 12건" 이라고 써놓고 목록·비율에 장관 답변이 섞인다
- 🔴 **순위를 매기지 않는다** — 평균 대비·백분위·"N명 중 M위" 를 넣지 않는다.
  위원회마다 회의 빈도가 다르고 위원장·장관은 구조가 달라, 숫자를 나란히 세우는 순간 오해가 된다.
  비율은 **그 의원 안에서의 구성비**(회의 종류 분포)까지만 낸다
- 표시하는 것은 사실 4종뿐: **질의석 건수 / 위원장석 건수 / 발언한 날 / 회의 종류 분포** + 발언한 회의 목록
- 🔴 **해석 주의 4줄은 숫자와 세트다** (위원회별 회의 수 차이 · 위원장석은 사회 · 영상 길이는 개인 발언시간 아님 · 정부측/외부인 제외). 하나라도 빼면 위 숫자가 곧바로 오해가 된다
- 위원장석 타일은 `chairCnt > 0` 일 때만 — 모두가 채워야 할 칸처럼 보이면 그 자체가 점수판이 된다.
  값 색도 골드가 아니라 `--sub` 로 낮춘다 (같은 골드면 질의와 같은 축으로 읽힌다)
- 정당색 금지 — 막대·강조는 골드 단일색
- ⚠️ `.sp-kind-fill` 에 `min-width: 3px` 필수 — 1% 미만 구간(실측 소위원회 4건 = 0.38%)이 폭 0px 으로 렌더돼 막대가 아예 안 그려진다

**상임위 회의 참여율 (`.sp-rate`) — 건수에 분모를 붙이는 자리 (2026-08-15)**
소스는 MV `politician_committee_speech`. 소속 시작은 **이력이 있으면 이력(`politician_committee_history`),
없으면 "그 위원회 첫 발언일" 로 근사**하고, 그 이후 회의를 분모로 삼는다.
왜 이 형태여야 하는지(어떤 대안을 실측으로 버렸는지)는 마이그레이션 파일 주석에 전부 있다.

- **`start_exact` 가 두 경로를 가른다.** TRUE = 이력 기준 / FALSE = 첫 발언일 근사.
  근사면 **첫 발언 전 침묵기가 분모에서 빠져 값이 후하다** → 화면 주의 문구를 이 값으로 분기한다
  (`hasApprox` 면 문구 노출, `mixedStart` 면 행마다 `(시작일 추정)` 표기).
  이력이 쌓여 전부 TRUE 가 되면 **그 문구는 저절로 사라진다** — 그게 이력을 넣은 이유다
- ⚠️ MV 의 `base` 는 **`politician_committees` 에서 시작해야 한다.** 발언 기록에서 시작하면
  "배정됐지만 아직 한 번도 발언 안 한 사람" 이 행 자체를 잃는다. 이력이 정확해지면 그런 사람도 `0 / N` 으로 드러나야 한다
- ⚠️ 분모·분자를 셀 때 `cmt_mt` 를 먼저 걸고 speeches 를 **LEFT JOIN** 할 것 (같은 이유)

- 🔴 **순위(N명 중 M위)를 붙이지 않는다.** 쌍마다 분모가 3~103개로 달라 한 줄로 세우면 **순위가 활동이 아니라 표본 크기를 잰다.** 코호트 평균 대비 위치까지만
- 🔴 **`MIN_RATE_DENOM = 11` 이 이 지표의 생명선이다.** 근사 소속기간 2개월 미만 구간은 평균 분모가 2.4개뿐이라 **중앙값이 100%** 다 — "첫 회의는 정의상 발언한 회의" 라 1/1 이 보장되기 때문. 11개 위쪽은 소속기간과 무관하게 45~55% 로 수렴한다 (6~12개월 53.4 · 1~1.6년 45.0 · 1.6년+ 53.6)
  - ⚠️ **서비스의 `MIN_RATE_DENOM` 과 MV 의 `in_cohort` 조건은 같은 값이어야 한다.** 어긋나면 "평균 계산엔 안 들어갔는데 화면엔 비율이 뜨는" 행이 생긴다
  - 분모 미달이면 **비율만 감추고 건수는 보여준다** + 이유를 쓴다. 행을 통째로 빼면 "이 위원회는 왜 안 보이지" 가 된다
- 🔴 **장관·의장단·퇴임은 비율을 보여주되 평균과 겨루지 않는다** (`offDuty` — 평균선·강조색 끄고 사유 표기).
  상임위 활동이 줄어드는 게 당연한 자리라(실측 평균 **37.2%** vs 전체 49.7%) 평균선 옆에 두면 곧바로 "게으르다" 로 읽힌다.
  **값을 숨기지도 않는다** — 사실이고, 숨기면 왜 없는지 설명할 수 없다. 실측: 김윤덕(국토부 장관) 11.5% · 정동영(통일부 장관) 38.4%
  - ⚠️ 그래서 쿼리가 `excluded_reason` 을 따로 내린다. MV 의 `in_cohort` 는 4개 조건을 뭉친 불리언이라 **"분모가 얇아서" 와 "장관이라서" 를 구분하지 못하는데 화면 처리가 정반대다**
- **평균 기준을 반드시 같이 낸다** — 숫자만 두면 50%가 높은 건지 낮은 건지 알 수 없다.
  2026-08-15 에 표시 방식을 전면 교체했다 (구 버전은 **눈에 띄지 않아 사실상 없는 것과 같았다**):
  | | 구 (~2026-08-15) | 신 |
  |---|---|---|
  | 마커 | 2px × 8px, `opacity .55` | 2px, 막대 위아래로 6px 삐침 + **삼각 캡** + `--bg2` halo |
  | 위치 | `.sp-rate-track` **안** | `.sp-rate-gauge` (track 바깥) |
  | 평균 대비 | 없음 (눈으로 재야 함) | **`평균 +12.5%p` 칩** (`.sp-rate-delta`) |
  | 범례 | 없음 (`title` 툴팁뿐) | 소제목에 `▼ 의원 평균 50%` (`.sp-avg-legend`) |
  - 🔴 **마커를 `.sp-rate-track` 안에 되돌리지 말 것.** track 이 `overflow: hidden`(둥근 모서리용)이라
    위아래 삐침이 잘려 막대와 같은 높이가 된다 — 구 버전이 정확히 이 상태였다.
    막대 폭이 1,186px 이라 2px 선은 **폭의 0.17%** 다. 잘리면 아예 안 보인다
  - 🔴 **halo(`box-shadow: 0 0 0 2px var(--bg2)`)가 핵심이다.** 마커가 골드 fill 위에 놓일 때와
    회색 track 위에 놓일 때 같은 세기로 보여야 한다. 색만으로 가르면 fill 안쪽에서 묻힌다
  - 🔴 **결국 제일 잘 보이는 건 선이 아니라 글자다.** `.sp-rate-delta` 칩이 "그래서 평균보다 위인가" 에
    바로 답한다. 마커는 *얼마나* 차이 나는지를 보여주는 보조다 — 둘을 세트로 볼 것
  - ⚠️ **11px 소형 텍스트라 대비비 4.5:1 이 필요하다.** 칩의 골드는 `--accent`(#B8740C, 흰 배경 **3.79** 미달)가
    아니라 **`--accent2`(#925C09, 5.59)** 를 쓴다. 회색도 `--sub2`(4.0)가 아니라 `--sub`.
    20px 값(`.sp-rate-val`)은 large text 라 `--accent` 그대로 괜찮다
  - ⚠️ `'near'`(±5%p 안) 구간엔 숫자를 안 붙이고 **`평균과 비슷`** 이라고만 쓴다. 분모가 얇아 그 정도 차이는
    의미가 없는데, 숫자를 쓰는 순간 의미가 있는 것처럼 읽힌다
  - ⚠️ 범례는 `hasComparable` 일 때만 — 전부 겸직·퇴임이면 마커가 한 줄도 안 그려져 가리킬 대상이 없다
  - ⚠️ 범례 글리프는 **막대 마커와 같은 모양**(삼각+선)이어야 한다. 2px 선만 두면 그냥 구분자(`|`)로 읽힌다
  - ⚠️ ≤560px 에선 `.sp-rate-head` 를 `flex-wrap` 시켜 칩+값을 아랫줄로 내린다. 칩이 ~140px 을 먹어서
    `기후에너지환경노동위원회`(12자)만 해도 이름이 두세 줄로 접힌다. 실측 375px 가로 오버플로 0
- 평균 위쪽만 골드. **아래쪽에 빨강을 쓰지 않는다** (근사값이라 단정할 수 없고, 정당색은 금지).
  칩도 같다 — above 만 골드, near·below 는 무채색
- 코호트에서 **위원장을 뺀 것은 예방적 조치**다. 실측상 위원장이 더 높지 않았다 (분모 11+ 중앙값: 간사 54.3 · 위원 50.0 · **위원장 48.7**). 6쌍뿐이라 평균에 영향도 없다 — 그래도 빼두는 건 "사회 보는 자리가 평균을 올렸다" 는 반론을 없애기 위함
- ⚠️ **해석 주의는 숫자의 전제다**: ① (근사 구간이 있을 때만) 첫 발언 전 침묵기가 분모에서 빠져 **실제보다 후한 값** ② 분모는 상임위 회의만 (국감·본회의는 제목에 위원회명이 없어 253개 회의가 0개 매칭)
  - ⚠️ 이걸 `<p>` 안의 `<li>` 로 쓰면 **브라우저가 문단을 닫아 문구가 통째로 사라진다** (실제로 그렇게 렌더됐다). `<ul>` 이어야 한다
- 실측 (2026-08-15): 388쌍 / 코호트 164쌍(151명) · 평균 **49.7%** · 중앙값 50.7% · 평균 분모 46개.
  **분모 미달이 55.2%인 건 후반기 원구성 직후라서**다 (현재 소속 위원회 첫 발언이 2026-07 에 137명 · 08 에 48명). 연말이면 대부분 11개를 넘긴다 — 배치가 이 비율을 매일 로그로 남긴다

**회의 목록 (`.sp-mt`) — 단위가 클립이 아니라 회의다**
- 🔴 **클립 단위로 늘어놓으면 안 된다.** 한 회의에서 클립이 최대 **83개** 나온다 (이인선 · 2025-07-14 여성가족위).
  의원당 클립은 중앙값 147 · 최대 **2,598**(최민희)인데 회의로 묶으면 **121개**로 줄어든다 (압축비 21.5:1).
  같은 회의 제목이 수십 번 반복되면 기록이 아니라 노이즈다 — 동명 법안 카드가 20장 붙어 있던 것과 같은 문제
  - 회의 단위는 화면의 **"발언한 날 N일" 과 같은 축**이기도 하다. 클립 8건만 보여주면 "144일 발언" 이라 써놓고 목록은 **3일치**만 나온다 (실측)
  - 의원당 회의 수: 최소 2 · 중앙값 **58** · 최대 **155**
- **회의 영상 URL 은 클립 URL 에서 `no=` 만 떼면 된다** (2026-08-15 실측 확인 — 그 회의 전체 영상 페이지로 이동).
  `mc·ct1·ct2·ct3` 가 회의를 특정하므로 아무 클립이나 재료로 쓴다. 원천이 `http` 라 `https` 로 올린다
- 기본 8개 + `회의 N개 더 보기` 토글. **전체를 SSR 로 내려보내고 접는 것만 화면이 한다** (토글에 서버 왕복 없음)
  - ⚠️ `.sp-mts` 가 flex 라 `[hidden]` 이 안 먹는다 → `.sp-mts[hidden] { display: none }` 필수
    (`bill_detail` 의 `.ba-proposers-grid`, `briefing` 의 `.bf-rest` 와 같은 함정)
- ⚠️ 한 회의에 질의석·위원장석이 섞이면 **둘 다** 적는다 (위원장이 질의도 한다 — 김현 실측 19회).
  우세한 쪽만 적으면 나머지가 사라진다
- ⚠️ 목록은 **시간순 그대로** 둔다. "질의석 우선" 같은 선별을 넣으면 사실 나열이 아니라 편집이 된다
- ⚠️ **행 마크업을 들여쓰기 없이 한 줄로 쓴다.** EJS 는 들여쓰기를 그대로 출력하는데 최대 155행이라
  그 공백만 **36KB(섹션의 43%)** 였다. 평평하게 고쳐 48KB / 3% 로 내렸다
  - 🔴 **EJS 주석·문자열 안에 닫는 태그(`%` + `>`)를 쓰지 말 것** — EJS 는 주석 안이든 문자열 안이든
    가리지 않고 **텍스트로** 찾아 거기서 스크립틀릿을 닫는다. 실제로 이 주석을 쓰다가 컴파일 에러를 냈다
  - 섹션 실측: 김현(113회의) 48KB · 최민희(121) 46KB. 단 이건 **origin 기준**이고 반복 들여쓰기는
    가장 잘 압축되는 것이라 사용자가 받는 양은 훨씬 작다 — 아래 "전송 압축" 참조 (2026-08-15 정정)

#### 표결 성향 카드 — 교차 표결 성향 (`.cpv-*`, 2026-08-05 추가)
찬반 비율 4줄 아래에 붙는 블록. **"당을 보고 투표하나, 법안을 보고 투표하나"** 를 보여준다.
- 쿼리: `daos/queries/politician/getCrossPartyVoteByMonaCd.sql`
- 지표: **자당 발의 법안 찬성률 − 타당 발의 법안 찬성률 = 격차(%p)**
  - 발의 정당 = `bills.mona_cd` → `politicians.party_name` (대표발의자 기준). 대표발의자 미상(위원장 대안 등)은 자당/타당 판정 불가라 **제외**
  - **불참 제외** — 모수에 넣으면 출석률 낮은 의원의 찬성률이 같이 깎여 "당 성향" 과 "성실성" 이 섞인다
  - 백분위 모집단: 자당·타당 각각 **50건 이상**인 의원만 (표본 적으면 격차가 요동침). 실측 266명
- 실측 분포 (2026-08-05): 최소 -1.2 / 중앙값 **3.4** / 최대 **30.9** %p, 표준편차 4.81 → 변별력 충분
  - 정당별 평균 격차: 민주 2.5 / 국힘 7.4 — 다수당·소수당 의사일정 구조 차이가 섞여 있어 **단정 금지**. UI 에 해석 주의 문구 필수
- UI 규칙:
  - **정당색 금지** — 자당 `--accent` 골드 / 타당 `--sub2` 회색, 명도로만 구분. 무소속·소수정당도 같은 UI 로 처리됨
  - 격차 숫자 단독으로는 크기를 가늠할 수 없어 **중앙값 + 순위(N명 중 M위)** 를 반드시 동반
  - "반대·기권 N건 중 M건이 타당 발의" 한 줄 — 희소 신호(이견)가 어디로 향하는지가 가장 직관적
  - 폴백: 자당/타당 표결이 하나라도 0이면 블록 자체를 렌더하지 않음 (예: 무소속 한동훈). 50건 미달이면 순위만 숨기고 비율은 표시
- **사전 계산** (2026-08-05): 집계 본체는 materialized view `politician_cross_party_vote`
  - 매 요청 계산 시 의원 목록 쿼리가 88ms → 180ms 로 늘고, `bill_votes`(현재 177,260행)가 늘수록 나빠져서 MV 로 뺐다. 적용 후 92ms 로 복귀
  - 갱신: `batch/refreshCrossPartyVote.js` (`REFRESH ... CONCURRENTLY`, 0.4초). `batch:daily` 체인의 syncVotes **다음**에 위치 (bills·votes 가 입력)
  - `CONCURRENTLY` 를 쓰려면 UNIQUE 인덱스 필수 (`ux_pcpv_mona_cd`) — 갱신 중에도 목록 페이지가 안 막힘
  - 상세 쿼리는 MV 를 읽어 중앙값·순위만 얹는다 (300행 스캔이라 비용 없음)
- **의원 목록 필터·정렬** (2026-08-05, 일치도 필터와 같은 패턴):
  - `#pol-gap-filter` 드롭다운 5옵션: `전체 / 법안 중심(2%p 미만) / 중간 이하(5%p 미만) / 뚜렷한 편(5%p 이상) / 매우 뚜렷(10%p 이상)`
  - `#pol-sort` 추가: `gap-desc`(당 성향 뚜렷한 순) / `gap-asc`(법안 중심인 순)
  - **일치도 필터와 달리 성향 진단 없이도 사용 가능** — 객관 데이터 기반이라 로그인·게임 완료 조건이 없다
  - 카드에 `data-gap` 서버 사전 계산. 값 없는 의원(표본 50건 미만·무소속 등 43명)은 필터 시 제외 / 정렬 시 항상 최후미
  - URL 키 `gap` 으로 영속화 (`loadFromUrl`/`saveToUrl`). 예: `/politician?gap=gte10&sort=gap-desc`
  - ⚠️ 배지 규칙이 2026-08-15 에 바뀌었다 — **모바일에선 `match`·`gap` 도 배지에 센다.**
    두 select 가 시트 안으로 들어가 **시트가 닫혀 있으면 배지가 유일한 신호**이기 때문이다.
    빼면 필터가 걸린 채 배지가 0 이 되어 왜 결과가 적은지 알 수 없다. 아래 "모바일 select 이동" 참조.
    정렬(`sort`)은 거르는 게 아니라 순서라 세지 않는다. 데스크톱은 배지가 숨겨져 영향 없음
- **숫자로 본 국회 「당을 보나, 법안을 보나」** (`#xr-gapdist`, 2026-08-05): 개인 순위("266명 중 42위")의 배경이 되는 **전체 분포**
  - 쿼리 2개 — `getCrossPartyGapDist.sql` (2%p 폭 17구간 `width_bucket`, -2~32) / `getCrossPartyGapStats.sql` (사분위·중립/당파 인원·정당별 평균). 둘 다 MV 를 읽어 300행 스캔
  - 서비스 `buildGapDist()` 가 빈 버킷을 채움 — 안 채우면 분포 모양이 왜곡된다
  - 히스토그램에 **중앙값 점선** 오버레이. 10%p 이상 구간만 진하게 (합의 분포의 90% 강조와 같은 패턴)
  - 실측: 중앙값 3.4%p / 2%p 미만 100명(37.6%) / 10%p 이상 29명(10.9%) / 범위 -1.2~30.9
  - **정당별 평균 격차(국힘 7.4 · 민주 2.5)는 해석 주의 문구와 반드시 세트** — 다수당은 자기 법안이 무난히 통과되는 의사일정 구조라 격차가 낮게 나오는 경향. "어느 당이 더 당파적" 으로 읽히면 중립성 원칙 위반
  - 섹션 번호가 밀려 기존 03~10 → 04~11 로 재정렬됨 (`SECTIONS` 배열 + `.xr-no` 라벨)
- **숫자로 본 국회 「자당 법안엔 예외가 없다」** (`#xr-ratedist`, 2026-08-15): 격차가 아니라 **수준**.
  자당·타당 찬성률 **두 분포를 같은 축에 겹쳐** 그린다. 같은 MV·같은 모집단(266명)이라 위 섹션과 숫자가 맞물린다
  - 쿼리 2개 — `getCrossPartyRateDist.sql`(60~100% 2%p 폭 20구간) / `getCrossPartyRateStats.sql`
  - 🔴 **이 섹션의 결론은 하나다 — 자당은 좁고 타당은 넓다.**
    실측 자당 **94.9~100%**(폭 5.1, sd 0.92) vs 타당 **66.1~100%**(폭 33.9, sd 5.32).
    266명 중 **216명(81%)이 자당 99% 이상** → 갈리는 건 오직 타당 법안이다
  - 🔴 **`LEAST(width_bucket(...), 20)` 필수.** `width_bucket` 은 상한 이상을 범위 밖(21)으로 보내는데
    상한이 정확히 100% 이고 **자당 100% 가 128명(48%)** 이다. 안 접으면 가장 큰 막대가
    244 → 116 으로 그려진다 (실측으로 잡았다). 검증은 **버킷 합계 == 코호트 수**로 한다
  - ⚠️ 두 계열의 **최댓값을 공유**해야 한다(`yMax`). 각자 정규화하면 높이 기준이 달라져 대비가 사라진다
  - ⚠️ 하한(60% 미만)은 버킷에 접지 않는다 — 접으면 60%인 것처럼 보인다. `under_min` 으로 세어 각주로 알린다 (현재 0명)
  - 🔴 **"당에 갇혀 있다" 로 읽히게 만들지 말 것.** 본회의 안건은 위원회·법사위를 거치며 이미 걸러져
    찬성률이 구조적으로 높다 — 실측 표결 598건 평균 찬성률 **97.4%**, 전체 표결에서 **반대는 0.66%**.
    이 분포는 당파성의 크기가 아니라 **본회의가 어떻게 굴러가는지**에 더 가깝다. 각주 3줄은 숫자와 세트다
  - ⚠️ 각주의 598·97.4·0.66 은 **쿼리 산출값**이다 (`floor_bills`/`floor_avg_for`/`oppose_pct`).
    화면에 하드코딩하지 말 것 — 표결이 쌓이면 움직인다
  - 정당색 금지: 자당 골드 채움 / 타당 무채색 외곽선. 정당이 아니라 **관계**를 가르는 대비라 허용된다
- **`/xray` 지표와 중복 아님** — 세 축이 각각 다르다:
  | 지표 | 축 |
  |---|---|
  | 당론 이탈 (`getDissentRank`) | 소속당 **다수 입장 vs 나** (내부 이탈) |
  | 초당 협력 (`getCrossPartyStats`) | 공동**발의**진 정당 다양성 (표결 아님) |
  | 교차 표결 격차 (신규) | **상대 당 발의 법안**을 어떻게 대하나 (외부 태도) |
- **법안 활동 탭**: 전체/대표발의/공동발의 필터 + 법안 리스트, 카드 클릭 시 `/bill/:id` 내부 링크
- **표결 내역 탭**: 본회의 표결 기록 리스트 (최근 50건 + 전체 개수 표시)
- **국민 평가 탭**: `PB.mountRating` + `PB.mountComments` 위젯 (클릭 시에만 마운트 — lazy)
- 사이드바 없음, `content-wrap` 은 단일 컬럼 max-width 1280px 컨테이너

### OAuth
- `GET /auth/google` → `GET /auth/google/callback`
- `GET /auth/kakao`  → `GET /auth/kakao/callback`
- `GET|POST /auth/logout`
- 기존 유저 → 로그인 완료, 신규 유저 → `req.session.oauthPending` + `/auth/setup` 리다이렉트
- 카카오 Client Secret 은 콘솔에서 "사용함" 이면 `KAKAO_CLIENT_SECRET` 환경변수 세팅 필수 (안 그러면 KOE010)

### REST API
| 메서드 | 경로 | 내용 |
|---|---|---|
| GET | `/api/auth/check-nickname?nickname=X` | 닉네임 중복 체크 |
| PUT | `/api/auth/nickname` | 닉네임 변경 (마이페이지 인라인 편집, requireLogin) |
| PUT | `/api/auth/profile` | **성별·연령대 변경** (2026-08-16, requireLogin) — `{gender, ageGroup}`, `AuthService.validate*` 통과값만. 통계용 값이라 본인이 고칠 수 있어야 한다 |
| DELETE | `/api/auth/withdraw` | 회원 탈퇴 (익명화) |
| GET / POST / PUT / DELETE | `/api/comments[/:id]` | 댓글 CRUD (소프트 삭제, 대댓글 1단계) |
| GET / POST | `/api/ratings/politician/:monacd` | 별점 조회/UPSERT |
| GET / POST | `/api/votes/bill/:billId` | 국민 찬반 조회/UPSERT |
| GET / POST | `/api/likes` | 좋아요 토글/카운트 |
| GET | `/api/bills/search?q=X` | 법안 검색 (커뮤니티 첨부용) |
| GET | `/api/bills/trending?sort=recent\|close\|popular\|bipartisan` | 홈 주목할 법안 (정렬 탭 동적 교체) |
| GET | `/api/bill/:id/analysis-status` | AI 분석 요청 상태 `{count, hasRequested, threshold}` |
| POST | `/bill/:id/request-analysis` | AI 분석 요청 (requireLogin, 멱등). `ALREADY_ANALYZED` 면 400 |
| GET | `/api/briefing/export[?date=YYYY-MM-DD\|?id=N]` | **자동화 툴(Make·n8n)용 내보내기** — 최신(또는 지정) 브리핑의 `publishable`·쓰레드 체인(short/full)·인스타 캡션·슬라이드 URL 을 JSON 하나로. env `BRIEFING_EXPORT_KEY` 가 있으면 `?key=`/`X-Export-Key` 필수. 아래 "SNS 자동 게시" 참조 |
| POST | `/community` | 게시글 작성 |
| PUT / DELETE | `/community/:id` | 수정/삭제 (본인만) |

### 법안 필터 URL 규약
- `/bill?committee=행정안전위원회` — 단일 위원회
- `/bill?committee=기획재정위원회,재정경제기획위원회` — **쉼표 분리 복수 매칭** (`string_to_array` 로 SQL IN 처리)
- `/bill?party=더불어민주당,국민의힘` — **대표발의 정당 복수 필터** (2026-04-25). `LEFT JOIN politicians p ON p.mona_cd = b.mona_cd` + `COALESCE(p.party_name, '기타/무소속') = ANY(...)`
- `/bill?bill_name=조세특례제한법 일부개정법률안` — **법안명 완전일치** (2026-08-11). 카드의 "같은 법률 N건 →" 링크가 여기로 착지
  - `search`(ILIKE 부분일치)와 별개다 — 부분일치면 `...법률안(대안)` 같은 변형까지 딸려와 카드에 표시한 건수와 결과 건수가 어긋난다
  - `getStatusCounts` 에도 같은 조건(`$3`)을 넣어 상태 탭 숫자를 맞춘다. 실측: 자본시장법 계열 → 배너 117건 / 탭 "전체 117"
- `/bill?has_analysis=Y` / `=N` — AI 분석 있는/없는 것만
- `/bill?ai_category_main=조세·재정,산업·R&D` — AI main 카테고리 복수 (2026-04-26 v4.1). 구버전 `?ai_category=` 도 자동 매핑되어 호환
- `/bill?request_status=any` / `=priority` — 미분석 + 요청 1명+ / 임계값 도달
- `/bill?sort=recent` (default) / `=ai_priority` / `=requested`
- 모두 AND 매칭. 통합 필터 카드 5항목은 (`has_analysis`, `request_status`) 페어 매핑으로 한 클릭에 두 키 동시 적용 (예: "💡 요청 있음" = `has_analysis=N&request_status=any`)
- 상태 탭 카운트(`getStatusCounts`)는 **committee · party · bill_name · search** 를 반영한다
  - ⚠️ **`search` 는 2026-08-15 에야 들어갔다.** 그전엔 `?search=조세&status=원안가결` 이 결과 0건인데
    탭에는 `원안가결 157` 로 떠 있었다 (검색을 무시한 전체 카운트라서)
  - 🔴 **`$4` 조건식은 `getList.sql` 의 `$1` 과 글자 그대로 같아야 한다**
    (`bill_name ILIKE` / `proposer_name ILIKE` / `bill_no` 3중). 어긋나면 탭 숫자와 실제 목록이 또 갈린다
  - ⚠️ 아직 반영 안 되는 필터가 남아 있다 — `has_analysis` · `ai_category_main` · `request_status`.
    이건 `bill_ai_analysis`·`bill_analysis_request_counts` 조인이 필요해서 미뤘다.
    그 필터를 켠 상태에서는 탭 숫자가 여전히 실제 결과보다 크다
- 운영자 다음-분석-큐 URL: `/bill?has_analysis=N&request_status=any&sort=requested`

### 필터 사이드바 UX (의원·법안 공통, 2026-04-25)
PC/모바일 동일 패턴으로 통일.
- 사이드바 상단에 `.filter-sheet-header { sticky top: 0 }` — `[필터] [초기화] [적용] [×(모바일만)]`
- 항목 클릭은 즉시 검색/navigation 하지 않고 **pending 상태만 토글**. 적용 버튼에서만 커밋
- 취소(×/backdrop/ESC): 시트 열기 전 상태 복원 (politician 은 state 스냅샷, bill 은 `loadFromUrl()` 재실행)
- **복수선택**:
  - politician: `state.sex/ageBucket/cmit/elect` 배열, 카테고리 내 OR · 카테고리 간 AND
  - bill: `pendingCmt` / `pendingParty` / `pendingAiCategory` Set, 적용 시 `?committee=A,B&party=X,Y&ai_category_main=X,Y` navigation. "기타/특별위원회" 는 minor 이름 쉼표 value 로 atomic 토글
- **단일 선택 (enum)**: bill 의 통합 AI 분석 카드 — `pendingHasAnalysis` ('' | 'Y' | 'N') + `pendingRequestStatus` ('' | 'any' | 'priority') 두 변수가 한 항목 클릭에 페어로 동시 토글. 같은 항목 재클릭 시 둘 다 '' 로 복귀(전체)
- 모바일(≤768px): `filter-sheet-btn` 이 검색 바 위 전체폭. 바텀시트 슬라이드업 + 백드롭. 활성 필터 카운트 뱃지엔 모든 필터 합산
  - 🔴 **닫힌 시트는 `visibility: hidden` 으로도 잠근다** (2026-08-16). `translateY(100%)` 만으로는 iOS Safari 에서
    시트 안 sticky 헤더가 뷰포트 기준으로 계산돼 화면 바닥에 `필터 · 적용 · ×` 줄이 삐져나왔다 (실기기 아이폰 실측).
    데스크톱·크롬 에뮬레이션에선 재현 안 됨. `.sidebar` 의 visibility 전환은 0.25s 지연 (닫힘 애니메이션 유지). `/bill` 도 동일
    - 🔴 **그래도 `/bill` 에선 실기기에서 흰 띠가 하단 바 자리에 간헐적으로 남았다** (뒤로/앞으로 이동하면 사라졌다 나타남 —
      합성 레이어 상태 문제). → `interactions.js` 의 시트 가드가 닫힘 완료 후(260ms) `#filter-sidebar` 에 **`hidden`(display:none)** 을 걸고,
      열 때는 풀고 20ms 뒤 클래스를 다시 붙여 전환을 살린다 (body 클래스 MutationObserver · resize · pageshow).
      두 뷰의 모바일 블록에 `.sidebar[hidden] { display: none }` 이 있어야 한다 (`.sidebar` 가 display:flex 라 UA 규칙만으론 안 숨는다).
      ⚠️ 여기서도 rAF 금지 — 비가시 탭에서 열림 자체가 안 됐다
    - 같은 이유로 nav 모바일 패널 `.pb-mobile-panel`(main.css)도 닫힘 시 `visibility: hidden` + `height: 100dvh`.
      **화면 밖으로 밀어두는 fixed 요소는 전부 이 규칙** — 새로 만들 때 transform 만으로 숨기지 말 것.
      2026-08-16 375px 스윕 16페이지: 가로 오버플로 0, 닫힘 상태에서 보이는 fixed 는 bill 상세 jumpbar(의도)뿐
- `.sheet-pending` CSS 전역. 서버렌더 `.active` 는 JS init 에서 제거 후 `.sheet-pending` 으로 교체

#### 모바일 select 이동 — 검색바의 드롭다운을 필터 시트로 (2026-08-15)
모바일 검색바가 여러 줄로 접혀 고정 크롬을 잡아먹던 문제. select 를 시트로 옮겨 줄인다.

| 페이지 | 옮기는 것 | 검색바 높이 | 고정 크롬 |
|---|---|---|---|
| `/politician` | 일치도·당성향·정렬 3종 | 233 → **129px** | 344 → **240px** (42% → 30%) |
| `/bill` | 정렬 1종 | 180 → **162px** | 296 → **278px** (34% → 31%) |

- 🔴 **복제하지 말고 같은 노드를 옮긴다.** id 가 둘이 되면 안 되고, 노드를 옮기면 걸어둔 리스너와
  현재 선택값이 그대로 따라온다. 데스크톱으로 넓히면 원래 자리로 되돌린다
- 🔴 **커밋 시점은 위치가 정한다** — 상단 바(데스크톱)는 즉시 적용, 시트 안(모바일)은 사이드바 항목과
  같이 `적용` 에서만. 시트에서 바꾸고 `취소` 하면 되돌아온다 (스냅샷에 `sort`/`match`/`gap` 포함)
- 🔴 **`/bill` 은 GET 폼이라 시트가 `<form>` 바깥이다.** 옮기면 폼에서 빠지므로
  `<select form="bill-filter-form">` 필수. 인라인 `onchange="this.form.submit()"` 도 제거했다 —
  시트 안에서 즉시 제출하면 **아직 적용 안 한 카테고리·정당 선택이 통째로 날아간다.**
  대신 `apply()` 가 select 값을 읽어 URL 에 싣는다
- 🔴 **`requestAnimationFrame` 으로 throttle 하지 말 것.** 탭이 렌더링하지 않으면 콜백이 아예 안 돌아
  그 사이 폭이 바뀌면 select 가 엉뚱한 자리에 남는다 (실측). 브레이크포인트를 넘을 때만 도는 동기 가드로 충분
- ⚠️ `matchMedia` 의 `change` 만 믿지 말 것 — 발화하지 않는 환경이 실재한다. `resize` 도 같이 듣는다
- ⚠️ 시트에선 3개가 세로로 쌓여 `70% 이상` 만 보이면 무엇의 값인지 알 수 없다 → **라벨을 붙인다**
- ⚠️ 자리 컨테이너는 `.sheet-selects:empty { display: none }` 이라 데스크톱에선 렌더되지 않는다.
  `:empty` 는 공백 텍스트도 자식으로 치므로 **마크업을 한 줄로 붙여 쓸 것**

### 법안 리스트 사이드바 카드 구성 (2026-04-26)
순서대로 4개 카드:
1. **AI 분석** (통합) — 5항목 단일 라디오: `전체 / 🤖 있음 / 없음 / 💡 요청 있음 / 🔥 우선 분석 대기 (5명+)`. 카운트는 `getRequestStats` (미분석 한정 LEFT JOIN) 결과로 카드값 ↔ 클릭 결과 일치 보장
2. **주제별** — `category_main` distinct 옵션, `aiCategories` 배열에 등장한 카테고리만 (분석 0건 카테고리는 노출 안 함)
3. **카테고리** — 위원회 (100건+ 위원회 개별, 미만은 "기타/특별위원회" 그룹)
4. **정당별 (대표발의)** — 7~8개 정당 + "기타/무소속"

### 법안 리스트 진행률 배너 + 정렬 드롭다운 (2026-04-25)
- **진행률 배너**: stepper 아래 카드 — "🤖 법안 N건 중 AI 분석 완료 M건" + 가로 막대(`progress-bar-fill`) + 퍼센트
- **정렬 드롭다운**: 검색 바 옆 `<select onchange="this.form.submit()">` — `최신순(default) / 분석 있음 우선 / 요청 많은 순`. ai_priority/requested 만 분석 있는 카드를 위쪽에 띄움 (CASE WHEN ORDER BY)
- **카드 강조**: 분석 있는 법안은 `.has-analysis { border-left: 3px solid var(--accent) }` + `🤖 AI 분석` 배지 + `bill-card-summary` (세리프 14px, 2줄 클램프) + `category_main · category_sub` 메타. 미분석 + 요청 임계값 도달 시 `🔥 우선 분석 대기` 배지. 미분석 + 요청 1명+ 시 메타에 "💡 AI 분석 N명 요청"
- **카드 본문 2단 폴백** (2026-08-11): AI 요약이 있으면 그것, 없으면 **국회 원문 제안이유**(`bills.summary`)를 같은 자리에 노출
  - 왜: 법안의 **87%가 동명**("○○법 일부개정법률안" — 조세특례제한법 788건, 자본시장법 117건)이라 이름만으로는 카드가 구분되지 않는다. 이전에는 분석된 0.6%에만 본문이 있어 나머지는 이름·발의자·날짜뿐이었다
  - 톤으로 구분 — AI 요약 `.bill-card-summary` 는 **세리프 14px `--text`**(무겁게), 원문 `.bill-card-summary.is-raw` 는 **산세리프 13.5px `--sub`**(가볍게). 분석 있는 카드가 계속 먼저 눈에 들어오는 위계 유지
  - 원문에 "국회 원문" 같은 라벨을 안 붙인다 — 메타행의 `🤖` 배지가 이미 AI 여부를 말해주고, 18,000장에 같은 라벨이 반복되면 없애려던 "첫 줄이 다 똑같은" 문제가 되돌아온다
  - 쿼리는 `LEFT(b.summary, 600)` 로 잘라서 가져온다 (원문 최대 10,349자 — 통째로 실으면 50건 페이지가 수백 KB). 실측 페이지 136KB
  - ⚠️ **머리말 제거 필수** — 원문 99.8%가 `제안이유 및 주요내용` 줄로 시작한다. `summaryPreview()` 를 거치지 않으면 모든 카드 첫 줄이 같아져 원점으로 돌아간다
- **대표발의자 얼굴** (2026-08-11, `.bill-card-avatar` 40px / 모바일 34px): 카드 그리드를 `auto 1fr auto` 로 바꿔 첫 열에 배치. 동명 카드가 20장 붙어 있을 때 **글자를 읽기 전에** 구분되는 유일한 단서 (이름은 87%가 같고 요약은 2줄 클램프라 훑을 땐 안 들어온다)
  - 소스는 `getList.sql` 의 `p.photo_url AS proposer_photo` — `politicians p` JOIN 이 이미 있어서 SELECT 한 줄 추가로 끝
  - 사진 없는 368건(퇴임 의원 등)은 `avatarHtml()` 의 이니셜 SVG 로 폴백
  - ⚠️ **크기는 래퍼에 준다.** `avatarHtml()` 이 `style="width:100%;height:100%"` 인라인으로 반환해 부모를 채우는 설계라, 자식(`img`/`svg`)에 CSS 로 40px 을 걸면 인라인이 이겨서 무시된다 (실제로 이미지가 676×946 으로 터졌다). 원형은 래퍼 `border-radius:50% + overflow:hidden` 으로
  - 모바일 ≤768: `auto 1fr` 2열 + `.bill-card-right { grid-column: 1 / -1 }` — 아바타를 별도 행으로 떨구면 카드만 길어지고 구분에 도움이 안 된다
- **"같은 법률 N건 →" 칩** (2026-08-11, `.same-name-chip`): 반복돼 보이는 것이 중복이 아니라 원래 그런 계열임을 알려준다. 클릭 시 `?bill_name=` 계열 필터로 이동
  - `same_name_count > 1` 이고 `bill_name` 필터가 안 걸려 있을 때만 노출
  - ⚠️ **카드 전체가 `<a>` 라 중첩 링크를 못 쓴다** → `<span role="button" tabindex="0" data-href>` + document 위임 클릭에서 `stopPropagation()`. Enter/Space 키 핸들러도 같이 있어야 함
  - 계열 필터가 켜지면 목록 위에 `.same-name-active` 해제 바 노출 (`{법안명} 만 보는 중 · N건` + `전체 법안 보기 ✕`)

### 공용 미들웨어
- `middlewares/auth.js`
  - `requireLogin` — API 401 / 페이지 `/auth/login?next=...` 리다이렉트
  - `injectUser` — `res.locals.currentUser` + `req.session.userId` 주입
- `utils/dataFreshness.js`
  - `dataFreshnessMiddleware(db)` — `MAX(batch_runs.finished_at WHERE batch_name='syncBills' AND status='success')` 조회 + 10분 메모리 캐시, `res.locals.dataFreshness = { lastUpdated, relative, absolute }` 주입. `batch_runs` 가 비었으면 `MAX(bills.updated_at)` 으로 COALESCE fallback (마이그레이션 적용 전 호환)
  - ⚠️ 2026-08-04 소스 변경: `syncBills` 가 변경분만 UPDATE 하게 되면서 `bills.updated_at` 이 "배치 실행 시각"을 더 이상 보장하지 않음 (변경 없는 날엔 배지가 멈춤)
  - `formatRelativeKo(date)` — 분/시간/일/주/달 단위 한국어 상대시간
  - nav 배지(`views/layout.ejs` `.pb-nav-badge`)가 "● 법안 N시간 전 갱신" 렌더에 사용. 모바일(≤768px)은 숨김. `syncBills.js` 의 `ON CONFLICT ... updated_at = NOW()` 가 시각 소스 → 크론 배치가 배지를 실시간으로 갱신
- `middlewares/balanceGame.js` (2026-04-26)
  - `injectBalanceGameStatus(db)` — 세 값 주입:
    - `res.locals.balanceGameCompleted` boolean — **누적 모델 기준**: `user_axis_score.packs_completed` 에 `'general'` 포함 → true. 그 외(비로그인·종합팩 미완료·부분 풀이) → false
    - `res.locals.userAxis` `{economy, social, security, institution} | null` — 완료 유저의 4축 좌표
    - `res.locals.userDistanceQuartiles` `{q1, q2, q3} | null` — 의원 295명 거리 분포의 25/50/75 분위수. 단일 `PERCENTILE_CONT` 쿼리 (~수ms), 게임 완료 유저 한정
  - **의원 상세 「나와의 성향 일치」** (객관 착시 방지·D 레이어 본체, 2026-04-26 → **2026-08-15 히어로로 이동**):
    - 🔴 위치는 **히어로 우측 패널**이다 (`views/politician/_profile_vs.ejs`). 분석 탭 본문의
      전체폭 접힘 띠(`bg-vs-collapsible`)는 삭제됐다 — 상세는 위 「히어로 우측 「나와의 성향 일치」」 참조
    - 다이아몬드: 사용자 골드 채움 + 의원 무채색 점선, 좌표 수치는 SVG `<title>` 호버 툴팁 (라벨 겹침 회피).
      일치도(%) = `max(0, (1 - d/1.5) × 100)` — `politician.ejs` 와 **같은 식이어야 한다**
    - 축별 해석: 강도 4단계 (`<0.25 거의 같음 / 0.75 약간 차이 / 1.25 뚜렷한 차이 / 그 이상 정반대·큰 차이`)
      × 방향 (`둘 다 {SIDE} 쪽 / 반대 방향 / 한쪽 중도 / 둘 다 중도`).
      SIDE: economy 시장/개입, social 전통/자율, security 동맹/자주, institution 안정/개혁
      - ⚠️ 강도·방향을 **둘 다** 말해야 한다. "뚜렷한 차이" 만으로는 어느 쪽으로 다른지 모르고,
        "반대 방향" 만으로는 얼마나 다른지 모른다
    - Fallback 2종: 미완료 유저 → `is-pending` (진단 CTA, `/balance-game?next=` 복귀) /
      미산출 의원 (실측 1명) → `is-missing` (사유 표기 — 빈 칸으로 두면 고장으로 읽힌다)
  - **의원 페이지 일치도 필터·정렬** (D 레이어 본체, 2026-04-26):
    - `#pol-match-filter` 드롭다운: 전체 / 70%·60%·50% 이상 / 50% 미만 (5옵션). 미완료 유저는 `disabled` + tooltip "성향 진단 후 활성됩니다"
    - `#pol-sort` 추가 옵션: `match-desc` (일치도 높은 순) / `match-asc` (일치도 낮은 순 — 정반대 의원 발견). 미완료 유저는 option `disabled`
    - 좌표 미산출 의원: 필터 적용 시 제외 / 정렬 시 항상 마지막
    - **URL 영속화**: `loadFromUrl()` / `saveToUrl()` history.replaceState (클라이언트 사이드 reload 없음). 키: `party`, `committee`, `elect`, `sex`, `age`, `q`, `sort`, `match`. 배열은 쉼표 구분
    - `data-match-pct` 속성으로 카드별 일치도(%) 서버 사전 계산 → JS 필터/정렬에서 즉시 사용
  - 의원 카드 D 레이어 (politician.ejs 그리드·리스트 + politician_detail.ejs + balance/connect.ejs 미리보기):
    - 거리 = `sqrt(Σ(u.axis - p.axis)²) / 2` **— 2026-08-16 부터 경제·사회·제도 3축** (`utils/balanceDistance.js` 단일 소스). 일치도(%) = `max(0, (1 - d/1.5) × 100)` — 분모 1.5 (실측 거리 분포 보정). 「의원 성향 좌표 v2」 참조
    - **텍스트 통일**: `"나의 성향 진단과 N% 일치"` 한 줄. 모든 의원 동일톤 (이모지·라벨·거리값·v1 메타·tier 차등·골드 강조 모두 제거)
    - 두 라운드 연속 "차등 잘 안 보임" 피드백 → 시각 차등 자체가 정보 전달 못 한다고 결론. % 숫자 자체로 강도 명확
    - **위치** ("정체 → 활동 → 분석"): 그리드 카드는 `pol-overlay > pol-stats-line` 아래 (발의·공동 카운트 바로 아래) / 상세 페이지는 **히어로 우측 패널** (`.profile-vs`, 2026-08-15 이동. 구 `profile-match-row` 는 폐기)
    - 호버/탭 툴팁: `"당신 좌표와 4축 거리 N.NN. 매핑 v1 기준."`
    - 미완료/비로그인 → `"진단 후 일치도 표시"` (회색·이탤릭). 상세는 `<a href="/balance-game">` 카드 전체 클릭
    - 분위수(`userDistanceQuartiles`) 미들웨어 인프라는 유지 — UI 차등은 안 쓰지만 향후 단계 5 "비슷한 의원 TOP 3" 등에서 재사용
    - `getListWithStats.sql` / `getDetail.sql` 가 `LEFT JOIN politician_axis_score (mapping_version='v2')` 로 axis_* 컬럼 노출. 세 축 중 하나라도 NULL(서명 5건 미만)이면 일치도 미표시 (실측 약 17명)
    - 컴포넌트: `.pol-match-line` (그리드+리스트) / `.profile-vs` (상세 히어로) / `.bg-d-card-preview .pv-match` (connect 미리보기)

---

## 프론트엔드 상호작용 헬퍼 (`public/scripts/interactions.js`)
`window.PB` 전역 네임스페이스:
- `PB.fetch(path, opts)` — JSON + credentials 자동 처리
- `PB.spinner({ size, label })` — 공용 로딩 스피너 HTML (`/assets/imgs/spinner.svg` 기반, 자체 CSS 애니메이션). `.pb-spinner` 클래스로 main.css 에 스타일 정의. `PB.spinner.overlay()` 는 부모 위에 absolute 로 깔리는 변형. 위젯 초기 fetch (rating/comments/citizenVote) + 홈 trending sort 변경 + community write 법안 검색에 적용
- **페이지 전환 풀스크린 로더** (`#pb-page-loader` in layout.ejs) — 내부 링크 클릭 / 폼 submit 시 어두운 backdrop + 스피너로 전환 표시
  - 자동 트리거: document-level click(a[href]) / submit 리스너가 외부 링크·앵커·새 탭·동일 URL 등을 제외한 internal navigation 만 캐치. `e.defaultPrevented` 면 스킵 (AJAX 처리된 경우)
  - 스킵 마커: 링크/폼에 `data-no-loader` 속성
  - 프로그래매틱 navigation: `window.pbShowLoader()` / `pbHideLoader()` 직접 호출 (예: bill 필터 시트 적용 버튼)
  - bfcache 복원: `pageshow` 이벤트로 자동 hide
- `PB.mountRating({containerId, monaCd})` — 별점 위젯
- `PB.mountComments({containerId, type, targetId})` — 댓글 위젯 (작성·수정·삭제·좋아요·정렬)
- `PB.mountCitizenVote({containerId, billId})` — 법안 국민 찬반
- `PB.mountBillAnalysis({containerId, analysisData, bill, scrollTargetId})` — AI 법안 분석 5-Zone 위젯
  - `renderRichText()` 내부 헬퍼 — `<strong>` 만 허용하는 선별 이스케이프 (2026-04-24)
  - Zone 3 accordion — 첫 번째만 기본 펼침, 클릭 시 `max-height` 트랜지션
  - Zone 4 "찬반 투표하기" → `scrollTargetId` (기본 `citizen-vote-section`) smooth scroll
  - `analysisData` falsy 시 컨테이너 `display:none` (EJS 조건부 렌더와 이중 안전장치)
  - hookTag 카테고리는 `category_main · category_sub` 결합 (v4.1) — 구버전 `category` 도 fallback
- `PB.mountAnalysisRequest({containerId})` — AI 분석 요청 위젯 (2026-04-25)
  - `data-bill-id` / `data-count` / `data-threshold` / `data-has-requested` / `data-logged-in` 속성 읽음
  - `POST /bill/:id/request-analysis` AJAX, 401 시 `/auth/login?next=` 리다이렉트
  - 성공 시 카운트·진행 바 즉시 갱신, 버튼을 "✓ 요청했어요"로 교체, 임계값 도달 시 "🎉 충분한 요청이 모였어요" 메시지 추가
- `PB.avatarSvg(name, size)` — 이니셜 SVG 아바타 (라이트 파스텔 8팔레트)
- `PB.toChoseong(str)` / `PB.isChoseongOnly(q)` / `PB.matchesQuery(target, query)` — 한글 초성 검색 (2026-04-24)
  - 쿼리가 compat-jamo 자음(ㄱ-ㅎ)만이면 `toChoseong(target).includes(q)` 로 초성 부분일치, 그 외엔 일반 substring (영문은 `toLowerCase`)
  - 적용: 법안 상세 표결 모달 이름 검색, 의원 리스트 이름·지역구 검색
  - 🔴 **초성 쿼리는 이름에만 건다. 지역구에 걸지 말 것** (2026-08-15). 걸었더니 결과의 **54~83%가
    이름이 아니라 지역구로 매칭**됐다 (실측 `ㄱㅅ` 41명 중 22명 · `ㅂㅅ` 52명 중 38명 · `ㅇㅅㅈ` 6명 중 5명).
    원인이 구조적이다 — 통합 지역구명이 길어(`남원시장수군임실군순창군`) 그 초성 문자열에
    **웬만한 2~3자 조합이 전부 부분일치**한다. `ㅂㅅ` 는 '부산' 하나로 38명이 딸려왔고,
    `ㄱㄷㄱ`(강득구)에는 '서**구동구**' 가 걸렸다.
    → `PB.isChoseongOnly(q)` 면 이름만, 아니면 이름+지역구. 지역구는 한글로 치면(`강동`) 그대로 검색된다
  - 🔴 **`interactions.js` 는 `layout.ejs` 의 `<%- body %>` 보다 뒤에 로드된다** — 페이지 인라인 스크립트가
    먼저 돌아 초기 `applyFilter()` 시점에 `window.PB` 가 없다. 완성형 쿼리는 폴백(일반 부분일치)으로도
    맞지만 **초성 쿼리는 아무것도 못 찾아 0명**이 되어, `/politician?q=ㄱㄷㄱ` 같은 공유 링크가
    빈 화면으로 열렸다 (타이핑하면 그제야 정상). → `DOMContentLoaded` 에서 한 번 더 적용한다
- `PB.renderStars`, `PB.escapeHtml`, `PB.isLoggedIn()`, `PB.redirectToLogin()`
- `window.__USER__ = { id, nickname } | null` — 서버에서 주입

---

## 배치 파일 구조 (batch/)

| 파일 | 방식 | 설명 |
|------|------|------|
| `syncPoliticians.js` | 열린국회 API | 의원 마스터 동기화 |
| `syncBills.js` | 열린국회 API (`nzmimeepazxkubdpn`) | 법안 + 발의자 + committee/committee_id |
| `syncBillSummary.js` | 열린국회 API (`BPMBILLSUMMARY`) | 법안 제안이유·주요내용 원문 → `bills.summary`. **증분** (`summary_synced_at IS NULL` 만) — `--full` 로 전건 재수집, `--limit N` 으로 부분 실행 |
| `syncVotes.js` | 열린국회 API (`nojepdqqaweusdfbi`) | 본회의 표결 (수집 완료 177,260건). **증분 스캔** — `--full` 로 전건 재스캔 |
| `syncMissingBillDetails.js` | ALLBILL API | 상세 누락분 보강 |
| `syncCommittees.js` | 열린국회정보 (`nktulghcadyhmiqxi`) | 위원회 위원 명단 → `politician_committees`. **전체 교체**(스냅샷) · `--dry-run`. 실측 477행 1.0초. 교체 **전에** 스냅샷을 비교해 `politician_committee_history` 에 변경분 기록 |
| `syncSpeeches.js` | 열린국회정보 (`npeslxqbanwkimebr`) | 발언영상 → `politician_speeches`. **연도 단위 UPSERT**(증분 인자가 없다) · 기본 올해분 · `--full` `--year N` `--dry-run`. 실측 올해분 6초 / 전건 54초 |
| `refreshCommitteeSpeech.js` | DB 집계 | `politician_committee_speech` MV 갱신 (`REFRESH ... CONCURRENTLY`, ~2.4초). 상임위 발언 참여율. **syncSpeeches·syncCommittees 다음에 실행** |
| `syncPhotos.js` | 크롤링 | 의원 프로필 사진 |
| `updateCommittee.js` | 열린국회 API | `syncBills.js` 이전 레코드 committee 컬럼 보강 (pSize=1000, bulk VALUES UPDATE) |
| `syncBillAiAnalysis.js` | pal.assembly.go.kr 크롤 + Claude Haiku 4.5 | AI 법안 분석 (v4.1, 16종 카테고리) |
| `reclassifyCategories.js` | Claude Haiku 4.5 | 자유 카테고리 → v4.1 16종 main+sub 일괄 재분류 |
| `billCategories.js` | (모듈) | 16종 카테고리·정의·tie-breaker 공유 (분석/재분류 배치가 import) |
| `calcGroupAxisAvg.js` | DB 집계 | 인구 그룹별 4축 평균 일배치 (밸런스 게임 단계 4 비교용). 'all' + (gender × age_group), user_count >= 50 만 평균 채움 |
| `calcPoliticianAxis.js` | DB 집계 | `bill_axis_mapping × bill_co_proposers`(v2, 기본) 또는 `× bill_votes`(v1) → `politician_axis_score`. 축당 서명 5건 미만·안보축은 NULL. 인자 `--version v2` `--source coproposers|votes` `--min-votes 1`. 분포 히스토그램 + 정당별 평균 검증 출력. **v2 전환 2026-08-16** — 위 「의원 성향 좌표 v2」 |
| `mapBillAxisPilot.js` | 법안 원문 + Claude Haiku 4.5 | **법안-축 AI 매핑** (2026-08-16). 축·방향·confidence 분류 → `bill_axis_mapping_pilot`, (축×방향) 8셀 정원까지 채움 → 결정적 균형 선별 → `--sync-v2` 로 `bill_axis_mapping` v2 미러링. `--target` `--max-candidates` `--select-only` `--sync-v2` `--dry-run`. **크론 아님 — 분기 1회 로컬** |
| `validateAxisPilot.js` | DB 집계 | 파일럿 매핑 × 공동발의 좌표 검증 (η²·탈락률·분할-반 신뢰도·확장 상한). 수동 |
| `calibrateAxisAnchors.js` | DB 집계 | **눈금 보정** (2026-08-16) — 문항(v1) 부호 ↔ 매핑 법안(v2) 부호가 같은 쪽인지. 문항별 앵커 법안·키워드 추정 부호·서명자 좌표 방향 → `out/axis-calibration.md`. `--q q2` 로 한 문항. **AI 호출 0.** 결과는 위 「진단의 의도를 화면에 쓴다」 아래 실측 |
| `findRareCellCandidates.js` | DB 집계 | **희소 셀(전통·안정) 사람 검토 후보** (2026-08-16) — none/반대방향/low/미분류 + 서명자 쏠림 신호를 주제별 표로 → `out/rare-cell-candidates.md`. **AI 호출 0.** 실측 수확 2건 — 위 「희소 셀 사람 검토」 참조. 다시 돌리기 전에 그걸 읽을 것 |
| `refreshCrossPartyVote.js` | DB 집계 | `politician_cross_party_vote` MV 갱신 (`REFRESH ... CONCURRENTLY`, ~0.4초). 의원 목록의 격차 필터·정렬이 이걸 읽는다. **syncBills·syncVotes 다음에 실행** |
| `refreshDissent.js` | DB 집계 | `politician_dissent` MV 갱신 (`REFRESH ... CONCURRENTLY`). "숫자로 본 국회"의 소신 표결이 이걸 읽는다. **syncPoliticians·syncVotes 다음에 실행** |
| `genBriefing.js` | 그날 법안 전건 + Claude Haiku 4.5 | 브리핑 카드 생성 (v2 프롬프트, 주제 묶음). 하루 1콜 · `--date` `--limit` `--force` `--dry-run`. `START_DATE`(2026-08-13) 이후 · 주말 제외 · 활동 없는 평일은 `model='none'` 카드. **체인 맨 뒤** — 그날 법안·요약이 다 들어온 뒤 읽는다 |
| `genInstaCards.js` | 헤드리스 브라우저 | **인스타 캐러셀 PNG + 캡션** 생성 (`npm run insta`). `--id` `--date` `--out` `--base`. **로컬 전용** — 크론 체인에 넣지 않는다 |
| `genBriefingVideo.js` | 헤드리스 브라우저 + `say` + ffmpeg | **유튜브 쇼츠 MP4** (`npm run video`). 카드 PNG 슬라이드쇼 + TTS 나레이션 + 자막, 60초 상한. `--date` `--rate` `--voice` `--tts edge`. **로컬 전용** — 위 「유튜브 쇼츠」 참조 |

### 배치 실행 순서 (2026-07-29 정리)
> ⚠️ 실행 전 `node -v` 확인 — **Node 22** (`.nvmrc` 22.20.0). Node 18 이면 undici 7 이 전역 `File` 부재로 즉사 (`ReferenceError: File is not defined`)

**정기 갱신 (의존 순서 고정)**:
```
1. syncPoliticians.js    # 의원 마스터
1-1. syncCommittees.js   # 위원회 위원 명단 — politicians 다음 (mona_cd 조인 대상)
1-2. syncSpeeches.js     # 발언 기록 — politicians·committees **다음**.
                         #   소스가 이름 문자열만 줘서 politicians 로 이름 매칭을 하고,
                         #   동명이인(박지원)은 politician_committees 로 가른다. 둘 다 최신이어야 귀속이 맞는다
2. syncBills.js          # 법안 + 발의자 — 의원과 JOIN. updated_at 이 nav "N시간 전 갱신" 배지 소스
3. syncBillSummary.js    # 제안이유·주요내용 — bills 참조 (신규 법안만 조회, 평시 수 초)
4. syncVotes.js          # 본회의 표결 — bills 참조
5. calcGroupAxisAvg.js   # 인구 그룹별 4축 평균 (1~4 와 독립, 매일 새벽 권장)
```

**조건부 (트리거 발생 시, 해당 sync 다음에)**:
| 배치 | 트리거 |
|---|---|
| `syncPhotos.js` | 의원 추가·변경 시 (syncPoliticians 다음) |
| `syncMissingBillDetails.js` | syncBills 후 상세 누락 발견 시 |
| `syncBillAiAnalysis.js` | 분석 요청 임계값(5명) 도달 또는 신규 가결 법안 (syncBills·syncVotes 이후 — `proc_result` 필요) |
| `calcPoliticianAxis.js` | `bill_axis_mapping` 변경 또는 syncBills(공동발의) 갱신 시 — 정기 체인에도 있다 |

> `refreshCommitteeSpeech.js` 는 정기 체인(`batch:daily`)의 `refreshDissent` 다음에 있다.
> 입력이 `politician_speeches` · `politician_committees` · `politician_titles` · `politicians.active_yn` 이라
> **`syncSpeeches` 와 `syncCommittees` 뒤여야** 한다.

**일회성 (완료, 재실행 불필요)**: `updateCommittee.js` (구레코드 committee 보강), `reclassifyCategories.js` (v4→v4.1 재분류 — 카테고리 체계 변경 시에만)

### 크론 배포 (Railway, 2026-08-04)
npm 스크립트로 체인을 고정 — Railway Start Command 는 이걸 부르기만 한다.
- `npm run batch:daily` — `syncPoliticians && syncCommittees && syncSpeeches && syncBills && syncBillSummary && syncVotes && refreshCrossPartyVote && refreshDissent && refreshCommitteeSpeech && calcPoliticianAxis && calcGroupAxisAvg && genBriefing`
  - ⚠️ `genBriefing` 은 **체인 맨 뒤**여야 한다 (그날 법안·요약이 다 들어온 뒤에 읽는다).
    2026-08-11 누락이 발견됐다 — 체인에 없으면 피드가 마지막 수동 실행 시점에서 **영구히 멈춘다**
  - ⚠️ 크론 서비스에 **`ANTHROPIC_API_KEY` 가 있어야 한다.** 없으면 매일 폴백 카드("데이터 요약")만 쌓인다
- `npm run batch:full` — `syncVotes --full` (수동 전건 재스캔. 크론 불필요 — 아래 참조)

Railway 설정 (웹 서비스와 **분리된 서비스 1개**, 같은 GitHub repo 연결):
| Start Command | Cron Schedule (UTC) | KST |
|---|---|---|
| `npm run batch:daily` | `0 19 * * *` | 매일 04:00 |

- ⚠️ **Empty Service 로 만들면 안 됨** — 소스가 없어 저장소 코드를 빌드/실행할 수 없다. `New → GitHub Repo → 3jjoda/politics` 로 생성 (또는 Empty 로 만들었으면 Settings → Source 에서 repo 연결)
- 두 서비스 모두 **Southeast Asia (Singapore)** 리전. DB 가 도쿄(`ap-northeast-1`)라 US West 는 태평양 왕복이 생김
- Usage limits: COMPUTE hard $10 / alert $5, AGENT hard $1. ⚠️ **오픈 시 hard limit 을 $20~30 으로 올려야 함** — 닿으면 웹까지 정지하므로 트래픽 몰린 날 사이트가 죽는다. → [ROADMAP.md](./ROADMAP.md) "오픈 당일 인프라 체크리스트"
- 실측 (2026-08-04 첫 프로덕션 실행): 체인 전체 3분 23초 — politicians 47s / bills 153s / votes 0.7s / axis 1s / group 0.7s. 싱가포르라 로컬(한국) 대비 개별 배치는 1.8배 느리지만, votes 증분화(140s→0.7s)가 상쇄
- 크론 서비스 Replica Limits 2 vCPU / 2 GB (실측 피크 218MB — syncBills 기준). 웹은 조이지 말 것: 상한에 닿으면 크론은 재시도로 끝나지만 웹은 OOM 으로 사이트가 죽는다
- 주간 전건 재스캔용 크론 서비스는 **만들지 않는다.** `syncVotes` 가 페이지 일부 누락 시 `vote_synced_at` 을 찍지 않아 다음 실행에 자동 재시도하므로 드리프트가 스스로 수렴한다. `--full` 은 로직 변경·매핑 갱신 후 검증용 수동 실행으로 충분

- ⚠️ **Railway Cron 은 UTC**. KST 변환 필수 (04:00 KST = 전날 19:00 UTC)
- ⚠️ **`railway.json` 을 repo 루트에 두면 안 됨** — 웹 서비스도 같은 루트를 읽어서 `cronSchedule` 을 물려받아 크론 잡으로 바뀐다(= 사이트 다운). 크론 설정은 대시보드 Settings 에서만
- 컨테이너가 **종료돼야** 다음 실행이 잡힌다. 이전 실행이 `Active` 면 Railway 가 다음 회차를 조용히 스킵하고, 멈춘 배포를 자동으로 죽이지도 않음 → `batch_runs` 에 `status='running'` 이 오래 남아 있으면 그 배치가 멈춘 것
- 그래서 배치 파일 안에 `cron.schedule(...)` 을 넣으면 안 된다 (프로세스가 종료되지 않아 이후 모든 실행이 영구 스킵). 최소 실행 간격은 5분
- 비용: 실행 중일 때만 과금(vCPU $0.00000772/초, 메모리 $0.00000386/초). 일 5분 × 30일 기준 월 $0.1 미만
- **워치독** (`utils/watchdog.js`, 2026-08-04): sync 배치 3종이 시작 시 타이머를 걸고(bills·politicians 15분, votes 20분) 초과하면 `process.exit(1)`. 배치가 멈추면 컨테이너가 종료되지 않아 **24시간 계속 과금**되는 게 크론 환경의 유일한 실질 비용 리스크라서. 타이머는 `unref()` 되어 정상 완료를 방해하지 않음
  - 발화 시 `batch_runs` 에 `status='running'` 이 남는다 → 멈춤 감지 신호
  - 같은 맥락에서 `syncPoliticians.js` 의 axios 호출에 누락돼 있던 `timeout: 15000` 보강 (bills·votes 는 원래 있었음)

### syncBills.js 결과
- RST_MONA_CD → bills.mona_cd, PUBL_MONA_CD → bill_co_proposers
- committee / committee_id / **처리 단계 날짜 9종** 동시 INSERT + ON CONFLICT UPDATE
- 18,692건 법안 + 240,391건 발의자 (88초, 2026-08-11 실측)
- ⚠️ `BILL_UPDATE_SET` 과 `BILL_CHANGED_GUARD` 는 **반드시 같은 컬럼 집합**이어야 한다. 가드에 없는 컬럼을 SET 하면 그 컬럼만 바뀐 행이 UPDATE 되지 않아 조용히 낡는다
- ⚠️ SET 절에 `updated_at = NOW()` 를 넣지 않는다 — `bills_touch_updated_at()` 트리거가 관리한다
- **변경 가드** (2026-08-04): `ON CONFLICT DO UPDATE` 에 `IS DISTINCT FROM` WHERE 절 추가 (`BILL_CHANGED_GUARD`). 이전엔 매 실행마다 전건(18,558행) UPDATE → dead tuple 하루 18k. 이제 값이 실제로 바뀐 행만 기록
  - 로그 `bills: 조회 N건 중 신규·변경 M건` — M 은 이제 "바뀐 행" 수 (전체 조회 건수와 다름)
  - 부수효과: `bills.updated_at` 이 "배치 실행 시각" → "법안 실제 변경 시각" 으로 의미 변경. nav 갱신 배지는 `batch_runs` 로 소스 이관, `syncVotes` 증분 조회의 신호로 사용

### ⚠️ `bills.updated_at` 은 트리거가 지킨다 — `bills_touch_updated_at()` (2026-08-11)
`bills` 전용 트리거. **원천(열린국회 API) 컬럼이 실제로 바뀐 경우에만** `updated_at` 을 민다.
동기화 부기 컬럼(`summary`, `summary_synced_at`, `vote_synced_at`)만 바뀌면 이전 값을 유지한다.

- **왜 필요했나**: 원래 공용 트리거 `update_updated_at()` 이 걸려 있어 **어떤 UPDATE 든** `updated_at` 을 밀었다.
  `syncBillSummary` 가 summary 백필로 18,631행을 UPDATE 하자 전건이 같은 시각으로 밀렸고,
  `syncVotes` 증분(4,541건 전건 재스캔 예약) · `syncBillAiAnalysis` 재분석(116건 오탐)이 동시에 깨졌다
- ⚠️ **공용 `update_updated_at()` 은 건드리지 않는다** — 다른 8개 트리거가 쓰고 있다
- ⚠️ **`bills` 에 컬럼을 추가하면 트리거 함수의 `ROW(...)` 목록에도 넣을 것.**
  안 넣으면 그 컬럼 변경이 `updated_at` 을 못 밀어 증분 배치가 조용히 놓친다
- 마이그레이션: `ddl/migrations/2026-08-11-bills-updated-at-trigger.sql`

> 🔴 **`bills.updated_at` 은 2026-08-11 이전 값이 전부 유실됐다. 그 전 시점의 변경 이력으로 쓰지 말 것.**
> summary 백필이 18,671건 전건을 `2026-08-11 01:07` 로 덮었고 원본은 복구 불가다 (감사 테이블 없음).
> - **신뢰 경계**: 2026-08-11 이후 실제로 바뀐 법안만 정상 값을 가진다. 그 이후로 안 바뀐 법안은 08-11 에 머문다
> - **`created_at` 으로 되돌리지 않았다** — `created_at` 은 "법안이 생긴 날" 이 아니라 "우리가 처음 긁어온 날" 이라
>   16,817건(90%)이 `2026-04-21` 최초 일괄수집일에 몰려 있다. 채워 넣으면 또 다른 거짓이 되고,
>   syncVotes 재스캔까지 건너뛰게 만들어 진짜 표결을 놓친다
> - 다행히 **사용자 노출은 0** 이다: `getListOne.sql`·`getAiAnalysis.sql` 의 SELECT 목록에만 있고 뷰·스크립트 참조가 없으며,
>   `dataFreshness` 의 `MAX(bills.updated_at)` 은 `batch_runs` 가 비었을 때만 쓰는 COALESCE 폴백이다
> - ⚠️ **"법안이 언제 처리됐나" 는 `updated_at` 으로 알 수 없다** (어느 컬럼이 바뀌었는지 기록이 없음).
>   그건 `bills.proc_dt` 등 **처리 단계 날짜 컬럼**을 쓸 것 — 아래 참조
- 검증된 동작: `summary`/`summary_synced_at`/`vote_synced_at` 단독 변경 → 유지 /
  `committee`·`proc_result_name`·`bill_name` 변경 → 밀림 / 부기+원천 동시 → 밀림 / 값 동일 UPDATE → 유지
- 참고: `NOW()` 는 트랜잭션 시작 시각 고정이라 한 배치 트랜잭션 안의 `updated_at` 은 모두 같은 값이다 (정상)

### syncVotes.js 증분 스캔 (2026-08-04)
대상 조회에 `AND (vote_synced_at IS NULL OR updated_at > vote_synced_at)` 추가.
- 이전: `proc_result_name IS NOT NULL` 전건 = 4,541건 매일 호출, 그중 표결 있는 건 598건뿐 (호출의 87%가 빈 응답, 일 ~5,700콜)
- 이후: 미스캔 + 변경분만. 조회 성공한 법안에 `bills.vote_synced_at = NOW()` 기록 (실패분은 자동 재시도)
- 본회의 표결은 확정 후 불변 + 표결 발생 시 `proc_result_name` 갱신 → `syncBills` 가 `updated_at` 을 밀어주는 흐름에 의존. **`syncBills` 변경 가드와 한 쌍**
- `--full` 플래그로 전건 재스캔 (페이지 단위 부분 실패 등 드리프트 보정용, 주 1회 권장)

### syncBillAiAnalysis.js (2026-04-25 신규, 04-26 v4.1)
**흐름**: 미분석 대상 조회 → `pal.assembly.go.kr/napal/lgsltpa/lgsltpaDone/view.do?lgsltPaId=<bill_id>` 본문 cheerio 파싱 → Haiku 분석 → `bill_ai_analysis` UPSERT
- 인자: `--limit N` (기본 3) / `--bill-id ID...` 직접 지정 (지정 시 아래 선별·정렬을 전부 건너뜀)
- **대상 선별 (2026-08-11 개편)** — `fetchTargets`:
  ```
  (미분석 OR 분석 후 법안 변경)  AND  (가결 OR 국민 요청 임계값 이상)
  ```
  | 조건 | 의미 |
  |---|---|
  | `a.bill_id IS NULL` | 미분석 |
  | `b.updated_at > a.analyzed_at` | 분석 이후 법안이 바뀜 → **재분석** (UPSERT 로 덮어씀) |
  | `proc_result_name IN ('원안가결','수정가결')` | 가결 법안 |
  | `request_count >= ANALYSIS_REQUEST_THRESHOLD` | 국민 요청이 모인 법안 (**계류여도 편입**) |
- **정렬**: `요청 많은 순 → 미분석 먼저 → 최신 발의순`
  - 가결만 보던 원래 조건은 정확성이 아니라 **비용** 때문이었다. 그런데 국민이 실제로 요청하는 건 대개 계류 중인 뜨거운 법안이라, 가결 필터를 두면 요청 시스템이 영원히 발화하지 않는다 → 요청이 임계값만큼 모이면 미처리여도 분석
  - 임계값은 `services/BillService.js` 와 **같은 env** 를 읽는다. 다르면 UI 의 "🔥 우선 분석 대기 (5명+)" 와 실제 배치 동작이 어긋난다
  - ⚠️ **재분석을 뒤로 미루는 이유**: `updated_at` 트리거가 거칠어 오탐이 많다. 실측(2026-08-11) 재분석 대상 17건이 전부 `updated_at='08-05 00:03'` 로 동일 — 개별 변경이 아니라 그날 `syncBills` 한 번이 일괄로 올린 것. 앞에 두면 무의미한 건이 매 실행 앞자리를 차지한다. 단 **요청 있는 법안은 첫 정렬 키에서 이미 최우선**이라 재분석이어도 즉시 잡힘
  - ⚠️ **재분석 트리거의 실제 범위**는 `syncBills.js` 의 `BILL_CHANGED_GUARD` 4컬럼(`bill_name`/`proc_result_name`/`committee`/`committee_id`)이 정한다. **"계류 → 가결" 은 잡지만 법안 본문 수정은 못 잡는다** — 본문은 `bills` 에 없고 매 실행 시 크롤하므로 감지 수단 자체가 없다 (본문 해시 저장이 필요)
  - 로그 배지로 각 분기 발화를 확인: `💡N`(요청) / `[계류]` / `[재분석]`
- 모델: `claude-haiku-4-5-20251001` / 가격: input $1.0, output $5.0, cache write $1.25, cache read $0.10 (per MTok)
- prompt caching 적용 (`cache_control: ephemeral`) 단 Haiku 4.5 임계값 미달로 현재 system(~3,300 tok)에선 활성화 안 됨 (cache_w/cache_r=0). 4,500+ 으로 늘면 자동 활성
- 요청 간 sleep 1500ms + 429 retry-after 대응
- 후처리: `TYPO_MAP` 오타 치환, `validateCategoryMain` (16종 외 라벨이면 `needs_review=true`), `shouldReview` 휴리스틱(연도 3+ / 기관·법명 5+ / limitations 3+)
- 비용 (v4.1, 2026-08-11 실측 66건): input ~4,700 tok / output ~2,200 tok, **1건당 $0.0160** (범위 $0.0004~$0.0214). 건당 소요 **~21초** (API 20 + sleep 1.5) → 50건 ~18분
  - 진행: 가결 602건 중 **65건 분석 완료(10.8%)**, 누적 $1.03. 남은 537건 추정 **~$8.6**
  - JSON 파싱 실패율 ~4% (50건 중 2건). 재시도 로직 없이 실패 처리되지만 다음 실행에 자동 재편입
  - ⚠️ `needs_review` 비율이 **43.9%** — `shouldReview` 휴리스틱이 과하게 걸려 검수 큐로서 변별력이 없다. 임계값 재조정 필요

### reclassifyCategories.js (2026-04-26 신규)
한 번의 Haiku 호출로 N건 일괄 재분류. v4 자유 카테고리 → v4.1 main+sub.
- 인자: `--all` (v4.1 도 강제 재분류) / `--dry-run` (DB 안 씀)
- `BEGIN`/`COMMIT` 트랜잭션, 16종 외면 `needs_review=true`
- 결과: 12건 $0.0068 (1건당 $0.0006) 매우 싸다 — 일괄 호출이라 카테고리 결정 컨텍스트가 한 번만 들어가서

> 폐기된 배치 파일(topicUpdate.js, updateByCommittee.js + `_` 백업본)은 2026-07-29 저장소에서 삭제됨. 내역은 [CHANGELOG.md](./CHANGELOG.md) 참조.

---

## 환경변수

```
# DB — config/database.js 가 읽는 실제 키. DATABASE_URL 은 코드에서 안 씀 (2026-08-04 정정)
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=6543
DB_USER=
DB_PASSWORD=
DB_DATABASE=postgres
DB_SSL=true
DB_CONNECTION_LIMIT=10              # 선택, 기본 10

# 서버
PORT=3000
NODE_ENV=production                 # ⚠️ 없으면 app.js 의 세션 쿠키 secure 플래그가 안 붙음
BASE_URL=http://localhost:3000      # 프로덕션: https://dangmalsa.kr
                                    #   ⚠️ 이 값이 og:url·og:image + passport 의 OAuth callbackURL +
                                    #      canonicalHost 대표 도메인을 전부 좌우한다.
                                    #      바꾸면 반드시 재시작 (passport 가 기동 시 1회만 읽음)
                                    # ⚠️ 없으면 layout.ejs 의 og:url/og:image 가 localhost 로 나가 SNS 썸네일이 깨짐
                                    #    passport.js 의 OAuth callbackURL 도 상대경로가 됨
TZ=Asia/Seoul                       # 서버 렌더 날짜가 프로세스 타임존을 타는 코드에 대한 안전망 (Railway 기본 UTC)

# 세션
SESSION_SECRET=<32자 이상 랜덤>

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=                # Kakao 콘솔에서 "Client Secret 사용함" 일 때만

# 공공 API / AI
OPEN_ASSEMBLY_API_KEY=
ANTHROPIC_API_KEY=sk-ant-...
ASSEMBLY_AGE=22

# AI 분석 요청 임계값 (기본 5명 — 도달 시 "🔥 우선 분석 대기" 표시)
ANALYSIS_REQUEST_THRESHOLD=5

# 관리자 (2026-08-12) — 쉼표 구분 이메일 허용목록. /admin/* 접근 권한
#   ⚠️ 비어 있으면 **아무도 못 들어간다** (설정 누락 시 열리는 것보다 닫히는 쪽이 안전)
#   ⚠️ 카카오 로그인 계정은 이메일이 NULL 이라 통과 못 한다 — 관리자는 구글로 로그인할 것
ADMIN_EMAILS=you@example.com

# Google AdSense (2026-08-10) — 승인 후에만 세팅. 비워두면 광고 관련 출력이 전부 꺼진다
ADSENSE_CLIENT_ID=ca-pub-0000000000000000

# 카카오 JS 키 (2026-08-16) — 성향 카드 「카카오톡으로 보내기」(이미지 카드 + 링크 버튼). OAuth REST 키(KAKAO_CLIENT_ID)와 다른 키.
#   Kakao Developers → 내 애플리케이션 → 앱 키 → **JavaScript 키**. 플랫폼 → Web → 사이트 도메인에 https://dangmalsa.kr 등록 (로컬 테스트면 http://localhost:3000 도).
#   없으면 버튼이 렌더되지 않는다 (시스템 공유 시트만)
KAKAO_JS_KEY=

# 검색엔진 소유 확인 (2026-08-16) — 콘솔이 준 <meta content="…"> 의 **값만** 넣는다 (태그 전체 X).
#   있을 때만 layout.ejs <head> 에 <meta name="naver-site-verification"> / google-site-verification 이 나간다.
#   네이버 서치어드바이저(searchadvisor.naver.com) → 사이트 등록 → HTML 태그 방식. 인증 후 sitemap.xml 제출
NAVER_SITE_VERIFICATION=
GOOGLE_SITE_VERIFICATION=
```

### Railway 서비스별 변수 배분 (2026-08-04)
| | 웹 (`politics`) | 크론 (`politics-cron`) |
|---|---|---|
| `DB_*` 6종 | ✅ | ✅ |
| `TZ=Asia/Seoul` | ✅ | ✅ |
| `OPEN_ASSEMBLY_API_KEY` | ✅ | ✅ |
| `ASSEMBLY_AGE=22` | — | ✅ |
| `PORT` / `SESSION_SECRET` / `NODE_ENV` / `BASE_URL` | ✅ | — |
| `GOOGLE_*` / `KAKAO_*` | ✅ | — |
| `ANTHROPIC_API_KEY` | — | ✅ **필수** — `batch:daily` 의 `genBriefing` 이 쓴다 (없으면 폴백 카드만 쌓임) |
| `ADSENSE_CLIENT_ID` | 승인 후 ✅ | — |
| `KAKAO_JS_KEY` | ✅ (발급 후) | — |
| `NAVER_SITE_VERIFICATION` / `GOOGLE_SITE_VERIFICATION` | ✅ (발급 후) | — |
| `ADMIN_EMAILS` | ✅ | — |

---

## Google AdSense (2026-08-10)

`ADSENSE_CLIENT_ID` (형식 `ca-pub-0000000000000000`) 하나로 전체가 켜지고 꺼진다. **승인 전에는 변수를 두지 않는다.**

| 위치 | 내용 |
|---|---|
| `app.js` | `ADSENSE_CLIENT_ID` 읽어 `app.locals.adsenseClientId` 주입 + `GET /ads.txt` 핸들러 |
| `views/layout.ejs` | `<head>` 에 `adsbygoogle.js` 스크립트 (`locals.adsenseClientId` 있을 때만) |
| `views/privacy.ejs` §6 | 광고 쿠키 조항 (2026-07-29 선반영) |
| `views/terms.ejs` | 제3자 광고 조항 |

- **head 스크립트 한 줄이 사이트 소유 확인 + 자동 광고를 겸한다.** 광고 단위를 코드에 심지 않아도
  AdSense 콘솔의 "자동 광고" 를 켜면 노출된다. 수동 단위가 필요해질 때만 `<ins class="adsbygoogle">` 를 추가
- `ads.txt` 는 파일이 아니라 **라우트로 생성** — pub 아이디를 저장소에 박지 않으려고.
  `ADSENSE_CLIENT_ID` 앞의 `ca-` 를 떼어 `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0` 를 응답
  - ⚠️ `express.static` 뒤에 등록돼 있으므로 **`public/ads.txt` 파일을 만들면 그쪽이 이긴다.** 둘 다 두지 말 것
  - ⚠️ 반드시 **apex 루트**(`https://dangmalsa.kr/ads.txt`)에서 200 이어야 한다. www 로 오면 `canonicalHost` 가 301 로 넘긴다
- ⚠️ **정치 중립성 리스크** — 정치 콘텐츠 사이트라 자동 광고에 특정 정당·후보 광고가 붙으면 브랜드 원칙과 정면 충돌한다.
  승인 후 AdSense 콘솔 → **차단 관리 → 일반 카테고리에서 "정치" 계열 차단** 을 반드시 먼저 걸 것.
  ⚠️ 이용약관 10항이 "정치 관련 광고 카테고리를 차단합니다" 라고 **이미 약속**하고 있다 —
  차단을 안 걸면 약관이 거짓이 된다 (위 "코드 밖 설정" 표에도 있음).
  선거기간에는 공직선거법상 광고 규제도 걸릴 수 있으므로 그 시기엔 정치 카테고리 차단 상태를 재확인
- **CMP(GDPR 동의 배너)**: Google 인증 CMP 중 **3가지 선택(동의 / 동의하지 않음 / 옵션 관리)** 채택.
  첫 화면에 거부 버튼이 없는 2가지 선택안은 동의율이 높지만 EEA 트래픽이 사실상 0이라 얻을 게 없고,
  투명성 브랜드와도 맞지 않아 제외. **코드 작업 없음** — `adsbygoogle.js` 가 알아서 배포하고,
  한국 방문자에겐 배너가 뜨지 않는다 (EEA·영국·스위스 한정)

### 진행 상태 (2026-08-10)
소유권 확인 ✅ · 검토 요청 ✅ · CMP 설정 ✅ → **심사 대기 중** (며칠~2주, 결과 메일).
승인 후 액션은 위 "정치 중립성 리스크" 항목.

---

## 크롤러 제어 — `robots.txt` · `sitemap.xml` (2026-08-15)

🔴 **이 사이트는 크롤러에게 URL 이 사실상 무한하다.** 이걸 막지 않으면 origin 이 통째로 노출된다.

| 경로 | 무한한 이유 |
|---|---|
| `/xray/chart` | **차트 스펙이 통째로 쿼리스트링**이다 (`source`·`axis`·`metric`·`filter`·`sort`) |
| `/bill` | `committee`·`party`·`ai_category_main`·`has_analysis`·`request_status`·`sort`·`search`·`bill_name`·`page` 조합 |
| `/politician` | `party`·`committee`·`elect`·`sex`·`age`·`q`·`sort`·`match`·`gap` 조합 |

전형적인 **faceted navigation crawl trap** 인데 2026-08-15 까지 `robots.txt` 자체가 없었다.
실제로 08-14 밤부터 16시간 동안 미국발 크롤러 한 곳이 **116,880 요청을 origin 에 직격**했다
(Cloudflare 캐시 히트 67건, 전체 트래픽의 99.5%가 미국 단일 출처, 한국은 283건). 상세는 CHANGELOG 2026-08-15 (3).

### `GET /robots.txt` — `app.js`
`ads.txt` 와 같은 **라우트 방식**. 파일로 두지 않는 이유는 `Sitemap` 지시자가 `BASE_URL` 기준 절대 URL 이어야 해서.
- ⚠️ `express.static` 이 위에 등록돼 있으므로 **`public/robots.txt` 를 만들면 그쪽이 이긴다.** 둘 다 두지 말 것 (`ads.txt` 와 같은 함정)
- **정책: 학습봇 차단 / 검색봇 허용** (2026-08-15 사용자 결정)
  - 차단 `Disallow: /` — `GPTBot`·`ClaudeBot`·`anthropic-ai`·`CCBot`·`Bytespider`·`Google-Extended`·`Applebot-Extended`·`meta-externalagent`·`FacebookBot`·`Diffbot`·`Omgilibot`·`ImagesiftBot`
  - 허용 — `OAI-SearchBot`·`Claude-SearchBot`·`PerplexityBot` 은 **의도적으로 목록에 없다.** `*` 그룹을 따라 크롤 트랩만 피해 돌게 한다. AI 답변에 출처로 인용될 길은 열어두고 통째 수집만 막는 절충
  - ⚠️ `Google-Extended`·`Applebot-Extended` 는 **크롤러가 아니라 학습 opt-out 토큰**이다. 막아도 Googlebot·Applebot 의 검색 색인에는 영향이 없다 — "검색이 막힌다" 고 오해해서 되돌리지 말 것
- ⚠️ **`Disallow: /bill?` 는 물음표로 시작하는 것만 막는다.** `/bill` 과 `/bill/PRC_…` 는 그대로 크롤된다. Google 은 **경로+쿼리스트링**에 접두 매칭하고 충돌 시 **더 긴 규칙이 이기므로** `Allow: /` 와 공존한다
- ⚠️ 세션 의존 페이지(`/my`·`/auth`·`/admin`·`/balance-game/{respond,reveal,compare,connect}`)도 차단한다 — 크롤러에겐 어차피 빈 화면이다
- ⚠️ `/briefing/*/card`·`/briefing/*/threads` 차단 — 같은 브리핑을 SNS 배포용으로 다시 그린 것이라 색인되면 **중복 콘텐츠**가 된다

### `GET /sitemap.xml` — `utils/sitemap.js`
쿼리스트링을 막으면 **목록 2페이지 이후로 가는 길이 끊긴다.** 사이트맵이 그 보완이다 —
크롤러를 무한 조합이 아니라 유한한 실제 콘텐츠로 유도하는 것이 목적. 둘은 세트다.

- 실측 **19,089 URL / 3.26MB** (법안 18,741 · 의원 309 · 브리핑 28 · 정적 11). 콜드 0.59초 → 캐시 0.006초
- 🔴 **6시간 메모리 캐시 + inflight 공유는 필수다.** 18,000행 쿼리라 크롤러가 반복 호출하면 **막으려던 그 부하가 여기서 다시 생긴다.** `XrayService` 섹션 캐시와 같은 수법
- `Promise.allSettled` — 한 소스가 죽어도 나머지는 낸다. 실패는 `logger.error` 로 남긴다 (조용히 빠지면 색인이 줄어든 이유를 알 수 없다). 생성 실패 시 낡은 캐시라도 응답 — 빈 사이트맵보다 낫다
- ⚠️ **`lastmod` 는 `TO_CHAR(…, 'YYYY-MM-DD')` 문자열로 받는다.** DATE 를 JS Date 로 받으면 타임존 해석이 끼어 하루 밀린다 (프로젝트 공통 규칙). 형식이 어긋나면 **아예 넣지 않는다** — 잘못된 `lastmod` 는 크롤러가 사이트맵 전체를 무시하는 사유다
- ⚠️ **URL 50,000개가 규격 상한**이다. 넘으면 사이트맵 인덱스로 쪼개야 한다. 조용히 자르지 않고 `logger.error` 를 남긴다
- ⚠️ 세션에 따라 내용이 달라지는 페이지는 `STATIC_PATHS` 에 넣지 말 것 — `robots.txt` 가 막고 있어서 **서로 모순된 신호**가 된다
- 페이지·소스를 추가할 때 손댈 곳은 `STATIC_PATHS` / `SOURCES` 두 배열뿐이다

### 전송 압축 — Cloudflare 가 한다. `compression` 을 붙이지 말 것 (2026-08-15)

🔴 **앱에 gzip 미들웨어가 없는 건 맞지만, 사용자는 이미 압축된 응답을 받는다.**
프록시가 켜져 있어 **Cloudflare 가 엣지에서 brotli(`Content-Encoding: br`)로 압축**한다.
이 문서 세 곳(브리핑 페이로드·발언기록 섹션·CHANGELOG 2026-08-11)이 **origin 크기만 보고
"gzip 이 없어서 무겁다" 고 적어놨었다.** 그 전제로 최적화를 다시 시작하지 말 것.

| | 실사용자 수신 (br) | origin 무압축 |
|---|---|---|
| `/politician` | **61KB** | 1,053KB |
| `/bill` | **33KB** | 205KB |
| `/briefing` | **20KB** | 92KB |
| `/xray` | **10KB** | 41KB |

- ⚠️ **`compression` 을 붙이면 오히려 나빠진다.** Cloudflare 는 origin 이 이미 압축해 보낸 응답을
  풀어서 br 로 재압축하지 않고 그대로 통과시킨다 → gzip 72KB vs 현재 br 61KB, **약 18% 손해**
- ⚠️ Railway 자체는 압축을 안 해준다. 이 이득은 **전적으로 Cloudflare 프록시(주황) 덕**이라,
  프록시를 끄면 전 페이지가 무압축으로 나간다
- ⚠️ **origin→Cloudflare 구간은 여전히 무압축이다** (`/politician` 1MB). `cf-cache-status: DYNAMIC` 이라
  HTML 은 매 요청 origin 직행 — 2026-08-14 크롤러 116,880 요청이 실제로 그만큼을 origin 에서 뽑아갔다.
  이건 압축이 아니라 **아래 캐시**로 푸는 문제다
- 판별법: `curl -H 'Accept-Encoding: gzip, br' -o /dev/null -D - https://dangmalsa.kr/politician` 에
  `Content-Encoding: br` 이 있는지. **localhost 직결로 재면 Cloudflare 를 안 거쳐 1MB 가 나온다** — 그게 오해의 출처였다

### 아직 안 한 것 — Cloudflare 캐시
**캐시 히트율 0.09%** 는 그대로다 (HTML 이 전부 origin 직행).
- 🔴 **캐시 룰을 걸 땐 세션 쿠키(`connect.sid`) 유무로 반드시 분기할 것.** 로그인 사용자의 nav 가 들어간 HTML 이 엣지에 캐시되면 **세션·닉네임이 다른 사람에게 노출된다**
- Cloudflare 무료 플랜으로 충분하다 (`Upgrade to Pro` 불필요). 봇 대응도 Bot Fight Mode + Rate limiting 규칙으로 무료 범위에서 된다

---

## 날짜·시간 처리 규칙 (2026-08-04 정립)

**Railway 컨테이너는 UTC**(`TZ=Asia/Seoul` 로 보정), **DB 는 2026-08-06 부터 `Asia/Seoul`** (`ddl/migrations/2026-08-06-db-timezone-kst.sql`). 둘 다 **안전망일 뿐** — 코드는 환경에 의존하지 않게 쓴다. 로컬 개발(윈도우 KST)에서는 문제가 전부 정상으로 보이므로 **로컬 테스트로는 못 잡는다.** 검증하려면 `TZ=UTC node app.js` 로 띄울 것.

> ⚠️ DB 타임존 설정은 `pg_db_role_setting` 에만 남는 데이터베이스 속성이라 **프로젝트를 새로 만들면 사라진다** (Supabase 리전 이전 등). 빠뜨려도 에러가 없고 모든 시각이 조용히 9시간 밀리므로, DB 재생성 시 위 마이그레이션을 반드시 다시 실행할 것.

### 한 줄 규칙 — **저장만 명시, 조회는 그냥**
| | 타임존이 틀리면 | 명시 변환 |
|---|---|---|
| **조회** (`TO_CHAR`·`CURRENT_DATE`) | 화면에 9시간 어긋난 시각. 설정 고치면 즉시 정상 | ❌ 하지 않음 (DB 설정에 위임) |
| **저장** (달력 날짜 INSERT/UPDATE) | **하루 틀린 날짜가 영구 저장**. 나중엔 틀린 줄도 모름 | ✅ 필수 |

### 저장 (INSERT / UPDATE) — 여기만 명시한다
| 무엇을 | 어떻게 | 비고 |
|---|---|---|
| **시각(instant)** | `TIMESTAMPTZ` + `NOW()` | 절대 시각이라 타임존 무관. **아무 조치 불필요** (현재 41개 컬럼) |
| **한국 기준 달력 날짜** | `(NOW() AT TIME ZONE 'Asia/Seoul')::date` | DB 설정에 기대지 말 것. **`CURRENT_DATE` 금지** |

DB 기본 타임존이 KST 라 `CURRENT_DATE` 도 지금은 맞는 값을 준다. 그래도 저장에서만 명시하는 이유는 **틀렸을 때 되돌릴 수 없기 때문**이다 — 설정이 빠진 상태로 크론이 04:00 KST(=19:00 UTC 전날)에 돌면 하루 이른 날짜가 영구히 박히고, 나중엔 틀린 줄도 알 수 없다.

대상 컬럼은 4개뿐 (전부 `batch/syncPoliticians.js`): `politician_party_memberships.start_date/end_date`, `party_names_history.start_date/end_date`. 나머지 DATE 컬럼(`propose_dt`/`vote_date`/`birthday`)은 API 에서 받은 값이라 무관.

### 조회 (SELECT) — 명시하지 않는다
DB 기본 타임존이 `Asia/Seoul` 이므로 **그냥 쓰면 된다.** 2026-08-06 에 `daos/queries/` 의 명시 변환 16곳을 전부 걷어냈다.

```sql
TO_CHAR(c.created_at, 'YYYY-MM-DD HH24:MI')   -- KST 로 나온다
CURRENT_DATE                                   -- 한국 기준 오늘
```

- 이 결과는 **오프셋 없는 KST 벽시계 문자열**이다. JS 에서 `new Date(s)` 로 바로 파싱하면 실행 환경 타임존으로 해석돼 어긋난다 → `utils/datetime.js` 나 `PB.timeAgo` 를 쓸 것 (둘 다 `+09:00` 을 붙여 파싱)
- 조회를 명시하지 않기로 한 근거: 표시가 틀리면 화면에 바로 보이고 DB 설정 한 줄로 즉시 복구된다. 저장과 달리 잘못된 값이 남지 않는다

### 표시 — `utils/datetime.js` (app.locals 전역 등록)
| 헬퍼 | 출력 | 용도 |
|---|---|---|
| `fmtDate(v)` | `2026.08.05` | 가입일·분석일 등 |
| `fmtDateTime(v)` | `2026.08.05 01:00` | 마지막 응답 시각 등 |
| `timeAgo(v)` | `3시간 전` (7일 초과 시 날짜) | 게시글·댓글 |

- ❌ `new Date(d).getFullYear()` / `.getDate()` / `.getHours()` — **로컬 getter 금지**. 프로세스 타임존을 탄다
- ✅ `Intl.DateTimeFormat(..., { timeZone: 'Asia/Seoul' })` — `utils/datetime.js` 가 이 방식
- 클라이언트는 `PB.timeAgo` (`public/scripts/interactions.js`). 서버 `timeAgo` 와 규칙 동일 (7일 컷오프)
- `TZ=Asia/Seoul` 환경변수는 **안전망일 뿐** — 코드가 환경에 의존하지 않도록 위 헬퍼를 쓸 것

---

## 법안 원문 표시 — `utils/billSummary.js` (app.locals 전역 등록)

`bills.summary` (국회 공식 "제안이유 및 주요내용")를 화면에 쓸 때 **반드시 이 헬퍼를 거칠 것.**

| 헬퍼 | 하는 일 | 용도 |
|---|---|---|
| `summaryPreview(text, maxLen=220)` | 머리말 제거 + 개행·중복공백을 한 칸으로 접기 + 길이 절단 | 목록 카드 (CSS 2줄 클램프와 세트) |
| `stripSummaryHeading(text)` | 머리말만 제거, 줄바꿈 보존 | 상세 페이지 전문 표시 |

- ⚠️ **원문의 99.8%가 머리말 한 줄로 시작한다** — `제안이유 및 주요내용` 15,450건 / `제안이유` 3,107건 / `■ 제안이유 및 주요내용`·`제안이유 및 주요 내용`·`제안이유 및 주용내용`(오타) 등 15종 변형.
  안 벗기면 모든 카드가 같은 첫 줄로 시작해서, 이 데이터를 넣은 이유(동명 법안 구분)가 그대로 무너진다
- 판정 방식: 변형 15종을 개별 매칭하지 않고 **"20자 이하 + 이유/주요내용 계열 단어"** 로 본다 — 새 변형이 나와도 걸린다. 본문 첫 문장은 최소 40자를 넘어 충돌하지 않음. 실측 18,631건 전건 제거 성공, 잔여 0
- 머리말로 판정되지 않으면 원문을 그대로 반환한다 (판정 실패 시 내용을 잃지 않도록)

### Git 안전 수칙
- `.gitignore` 에 OAuth/secret 파일 패턴 등록됨 (`*OAuth*.json`, `*secret*.json` 등)
- 실수로 시크릿 푸시된 경우: `git rm --cached` + `--amend` 로 로컬 커밋 정리, Google Console 에서 **Reset Secret** 권장

---

## 브랜드 에셋

### 현재 사용 중 (`public/assets/imgs/`)
- **모바일 햄버거 패널 `.pb-mobile-panel`** (2026-08-16): 순서 **계정 → 메뉴 → 갱신 배지**. `overflow-y: auto` + `100dvh` 로 자체 스크롤,
  열리면 `body.pb-menu-open` 이 뒤 스크롤을 잠그고 백드롭(`#pb-mobile-backdrop`)·ESC 로 닫힌다. 닫힘 상태는 `visibility: hidden`
- **nav 로고: `[mark-only.svg + wordmark-nav.svg]` │ `tagline.svg` 가로 락업** — 데스크톱 225×36 (마크 36 · 워드마크 h30 · 구분선 1×20 · 태그라인 h18) / 모바일 ≤768 183×30 (30 · h24 · 1×16 · h15). CSS `.pb-logo` > `.pb-logo-brand`(`.pb-logo-mark` + `.pb-logo-wordmark`) + `.pb-logo-div` + `.pb-logo-tagline-img`
- **login 카드: nav 와 같은 3에셋 조립** — 락업 161×84 (마크 48 · 워드마크 h40 가로배치 / 태그라인 h24 아래). 카드는 세로 여유가 있어 태그라인을 아래로 내리고 배율만 키움. CSS `.auth-logo` / `.auth-logo-brand` / `.auth-logo-mark` / `.auth-logo-wordmark` / `.auth-logo-tagline` (login.ejs 인라인)
- 파비콘: `favicon.ico`, `favicon-16.svg`, `favicon-32.svg`, `apple-touch-180.png`
  - ⚠️ **루트 `public/favicon.ico` 도 같은 파일이어야 한다** — `layout:false` 페이지(인스타 카드)나 아이콘 링크가 없는 응답은
    브라우저가 루트로 떨어진다. 2026-08-16 까지 리브랜딩 전 파일이 남아 카드 페이지에 구 로고가 떴다.
    `layout:false` 뷰를 새로 만들면 `<head>` 에 파비콘 링크를 직접 걸 것 (`card.ejs` 참조)
- 앱 아이콘: `app-icon-192.png`, `app-icon-512.png` (`public/manifest.json` 참조)
- OG: `og-image.png` (1200×630)

### 태그라인 "당 말고 사람" 표기 규칙
기준 에셋은 **`tagline.svg`**. `당` 을 흐리게, `사람` 을 골드로 눌러서 대비를 만드는 방식.

| 조각 | 색 | weight |
|---|---|---|
| `당` | `#A8A095` (흐림) | 500 |
| ` 말고 ` | `#6B7280` | 500 |
| `사람` | `#8F5800` (골드) | **800** |

- ⚠️ **취소선을 쓰지 말 것.** 초기 `logo-primary.svg` 에는 '당' 위에 골드 취소선(`<line>`)이 있었으나
  2026-08-10 제거 결정. 현재 코드가 참조하는 어느 에셋에도 취소선 없음 — 되살리지 말 것
- 새 태그라인 변형(다크·모노 등)을 만들 땐 위 3단 대비 구조를 유지할 것
- `tagline.svg` / `logo-primary.svg` 양쪽 '당' 모두 `#A8A095` 로 통일 완료 (2026-08-10)

### nav 락업 조립 규칙
```
[○卜 마크] 당말사  │  당 말고 사람
└── .pb-logo-brand ┘ div    tagline
      gap 9px        gap 12px
```
- **중첩 flex 로 간격을 2단 분리** — 마크↔워드마크는 한 덩어리라 좁게(9px), 구분선 기준 바깥은 넓게(12px).
  단일 `gap` 으로는 이 위계가 안 나옴
- 잉크 패딩까지 보정한 **시각 간격 실측**: 마크↔워드마크 12.2px / 워드마크↔구분선 14.9px / 구분선↔태그라인 14.1px
- 모든 SVG 가 잉크 세로중심 ≈ viewBox 중심이라 (`mark` -0.06 / `wordmark` -0.06 / `tagline` -0.5 단위)
  `align-items: center` 만으로 맞음 — 실측 정렬 오차 0.00px, 오프셋 보정 불필요

### ⚠️ 텍스트 SVG 의 `textLength` — 지우지 말 것
`wordmark-nav.svg`(116×46) 와 `tagline*.svg`(108×30) 는 viewBox 를 잉크에 타이트하게 재단해서
CSS `gap` 이 곧 시각 간격이 되고, 가운데 정렬 시 잉크가 실제로 가운데 오게 만듦.
그 대가로 **폰트 폴백 시 글자가 넓어지면 그대로 잘림**.

- SVG 를 `<img>` 로 로드하면 웹폰트를 못 받아 시스템 폰트로 폴백함 (페이지가 폰트를 로드해도 소용없음)
- `textLength` + `lengthAdjust="spacingAndGlyphs"` 로 advance 를 고정해 해결

| 파일 | textLength | 폴백 전 잉크 우측 | 고정 후 | viewBox 폭 |
|---|---|---|---|---|
| `wordmark-nav.svg` | 109.3 | 106.2 ~ **117.2** (Batang) | 109.7~111.9 | 116 |
| `tagline*.svg` | 101 | 103.6 ~ **122** (monospace) | 103.0~103.9 | 108 |

- 문구·자간·폰트크기를 바꾸면 **`textLength` 값도 같이 다시 재야 함**
  (캔버스 `measureText` 로 advance 측정 → 그 값을 넣기)
- `tagline*.svg` 3종(기본·mono·white)은 같은 geometry 라 한쪽을 고치면 나머지도 같이 고칠 것

### 미배치 (추후 활용)
**인레이형 계열** — '사' 자리에 마크가 박히는 형태. 2026-08-10 잠깐 nav/login 에 썼다가
**"텍스트가 장난스러워 보인다"** 는 판단으로 전부 마크 분리형으로 회귀. 파일은 보존하되 신규 적용 금지:
- `logo-primary.svg` (200×104, 태그라인 포함) / `logo-nav.svg` (196×66, 태그라인 없음)
- `logo-mono.svg` (인쇄·흑백) / `logo-white.svg` (다크 배경)

**평문 계열** — 마크 + '당말사' 텍스트:
- `logo-lockup.svg` — 마크 + 워드마크 + 태그라인 가로 (280×72). 단 태그라인이 **JetBrains Mono 단색**이라
  현행 `tagline.svg`(Pretendard + 당/사람 색 대비)와 처리가 다름. 쓰려면 먼저 통일할 것
- `wordmark-only.svg` — 워드마크 + 태그라인 2행 (240×80)
- `mark-white.svg` / `tagline-white.svg` — 다크 배경용 / `tagline-mono.svg` — 흑백 매체

**기타**: `splash.svg` (진입 로더, 전역 스플래시 UI 필요) / `loader.svg` (정적 마크, 실제 로딩엔 `spinner.svg`) / `app-icon-1024.png` (스토어 등록 시)

> 태그라인이 **구워진** 락업(`logo-primary` 200×104 / `logo-lockup` 280×72 / `wordmark-only` 240×80)은
> **nav 에 쓸 수 없음** — 로고행이 60px 라 h36~44 가 한계인데 그 크기면 태그라인이 5~8px 로 뭉개짐.
> 그래서 nav·login 모두 마크/워드마크/태그라인 **3에셋을 CSS 로 조립**하는 방식을 씀 (배율만 다르게).

### 디자인 규칙
- 브랜드 골드: `#B8740C` / 호버: `#925C09`
- 정당색(파랑·빨강) 사용 엄격 금지 — 중립성 브랜드 핵심
- 점 복(卜) 문양 획 방향: 우하단 ↘ (실제 기표봉 기준)

### 메타 태그 & PWA
- `views/layout.ejs <head>` — favicon 5종 + manifest + OG 11개 + Twitter 4개 + theme-color
- `og:url` / `og:image` 는 `process.env.BASE_URL + locals.currentUrl` 기반 절대 URL
- `public/manifest.json` — name/short_name/start_url/display=standalone/theme-color/icons(any maskable)

### 대표 도메인 (canonical host) — `middlewares/canonicalHost.js`
커스텀 도메인을 붙이면 apex·www·railway.app 세 주소가 같은 사이트를 서빙한다.
검색엔진엔 중복이고, 세션 쿠키가 host-only 라 주소별로 로그인이 따로 논다.
→ **`BASE_URL` 의 호스트 하나로 301 통일**.

- 대표 호스트를 하드코딩하지 않고 `BASE_URL` 에서 파싱 — 도메인이 또 바뀌어도 코드는 안 건드림
- `BASE_URL` 이 없거나 localhost/127.0.0.1 이면 **자동 비활성** (로컬 개발 방해 안 함)
- GET/HEAD → **301**, 그 외 → **308**. 301 은 클라이언트가 POST 를 GET 으로 바꿔도 되는 코드라 본문이 유실됨
- `express.static` **앞**에 등록 — 정적 파일까지 대표 주소로 몰기 위함
- `app.set('trust proxy', 1)` 이 전제 (Railway 프록시 뒤에서 `req.hostname` 이 X-Forwarded-Host 를 따르게)
- `views/layout.ejs` 에 `<link rel="canonical">` 동반 (쿼리스트링 제외, `locals.currentUrl` 기준)

> 커스텀 도메인 붙일 때 체크리스트: Railway 에 **apex·www 둘 다** 커스텀 도메인 등록(www 도 인증서가 있어야
> 리다이렉트가 HTTPS 로 깨끗함) → `BASE_URL` 갱신 → **재시작**(passport 가 기동 시 `BASE_URL` 로 callbackURL 을 만듦)
> → Google/Kakao 콘솔에 새 콜백 URI 등록.

### 정적 자산 캐시 무효화 (2026-08-10)
`express.static('public', { maxAge: '1h' })` + **파일명 고정**(내용만 교체) 조합이라,
그냥 두면 배포 후 최대 1시간 동안 브라우저가 옛 자산을 쓴다.
실제로 리브랜딩 배포에서 `wordmark-nav.svg` 가 구브랜드로 남는 문제가 발생했다.

- `app.js` — `ASSET_VER` = `RAILWAY_GIT_COMMIT_SHA` 앞 8자 (로컬은 기동 시각 base36)
- **정적 링크는 반드시 `asset()` 헬퍼를 거칠 것** — `<%= asset('/styles/main.css') %>`
  - 적용 대상: CSS(main + pageStyles) / JS / 브랜드 SVG / 파비콘 5종 / manifest / og:image·twitter:image / spinner
- JS 가 동적 생성하는 `<img>` 는 `window.__ASSET_VER__` 를 읽는 `PB.asset()` 사용
- 새 정적 참조를 추가할 때 `?v=` 를 빠뜨리면 배포 후 stale 자산이 노출된다

### 에러 페이지 (2026-08-10)
- `app.js` 라우트 등록 **뒤에** 404 캐치올 → 전역 에러 핸들러 순서로 등록 (순서 바뀌면 캐치올이 모든 요청을 먹음)
- 두 핸들러 모두 `res.render(view, locals, cb)` 의 **콜백으로 렌더 실패를 잡아 평문 fallback** 으로 끝냄.
  ⚠️ 이게 없으면 뷰가 없거나 깨졌을 때 에러 처리 중에 또 에러가 나서 스택트레이스가 노출된다
  (실제로 `error_pages/404` 뷰가 없어서 모든 not-found 가 500 으로 떨어지고 있었음)
- 에러 핸들러는 `res.headersSent` 면 손대지 않고 `next(err)` 로 넘김
- 스타일은 `public/styles/error.css` (`.err-*`), layout 을 그대로 타서 nav·footer 포함

### 개인정보 처리방침 §5 — 지우지 말 것 (2026-08-16)
🔴 **인프라(수탁자) 공개는 법정 고지 사항이다.** "굳이 우리 인프라를 알려줄 필요가 있나" 로 지우면 안 된다.
- 개인정보 보호법 **제26조** — 처리위탁 시 위탁 업무 내용과 수탁자를 **처리방침에 공개**해야 한다
- 같은 법 **제28조의8** — 국외 이전은 원칙적으로 별도 동의가 필요한데, 법정 항목을 처리방침에
  공개하면 "계약 이행을 위한 위탁·보관" 으로 동의 없이 처리할 수 있다.
  즉 **이 문단이 동의를 안 받아도 되게 해주는 근거**다
- 감춰도 실익이 없다 — `Server: cloudflare` 헤더와 커스텀 도메인 CNAME 으로 이미 드러난다.
  방어선은 자격증명·설정이지 벤더명 은닉이 아니다

**표에 반드시 들어가야 하는 것** (국외 이전 법정 기재사항): 수탁자 · 위탁 업무 · **이전 국가** ·
**이전 항목** · **보유·이용 기간** + 이전 시기·방법 + 수탁자 처리방침 링크 + **국외 이전 거부권 안내**
- ⚠️ 리전이 실제와 일치해야 한다 — Supabase 도쿄 / Railway 싱가포르 (CLAUDE.md "인프라 구성")
- ⚠️ **Cloudflare 를 빠뜨리지 말 것.** 프록시가 켜져 있어 전 트래픽이 거쳐가고 IP·요청 기록을 취급한다
- ⚠️ **소셜 로그인은 위탁이 아니라 수집 출처다** — 우리가 보내는 게 아니라 받는 쪽이라 절을 나눴다
- ⚠️ **Anthropic 도 위탁이 아니다** — 법안 원문만 보내고 개인정보를 안 보낸다. 단 브리핑 생성에도
  쓰므로 "법안 분석" 만 적으면 사실과 어긋난다
- ⚠️ 앱은 IP 를 저장하지 않는다 (`req.ip` 사용처 0곳). IP 를 다루는 건 Cloudflare·Railway 쪽이다
- ⚠️ 표는 `.legal-table-wrap` 안에서 가로 스크롤한다 (모바일에서 문서가 밀리면 안 된다)

### 이용약관 — 함께 봐야 하는 조항 (2026-08-16 개정)
🔴 **약관·처리방침·가입 화면은 세트다.** 한쪽만 고치면 문서끼리 어긋난다.

| 내용 | 이용약관 | 개인정보처리방침 | 가입 화면 | 서버 |
|---|---|---|---|---|
| **만 14세 이상만 가입** | 4항 | 1항 하단 | 필수 동의 체크 + 선택지 `14~19세` | `AuthController` `agree !== '1'` |
| 탈퇴 후 게시물 익명 유지 | 5항 | 3항 | — | — |

#### 가입 시 필수 동의 (2026-08-16 신설)
🔴 **가입 화면에 약관·개인정보 동의 절차가 아예 없었다.** 약관 1항의 "가입하면 동의한 것으로 봄"
(동의 간주)만 있었는데, 개인정보 보호법 제15조는 **수집·이용 동의**를 요구한다 —
처리방침을 게시해두는 것과 동의를 받는 것은 다르다.
→ `auth/setup.ejs` 에 필수 체크박스 하나(`name="agree" value="1"`)로 **둘을 함께** 받는다:
① 개인정보 수집·이용 동의 ② **만 14세 이상이라는 이용자의 진술**

- 🔴 **서버 검증이 실제 방어선이다** (`AuthController`, `createOAuthUser` 호출 앞).
  체크박스는 JS 로 우회된다. 미체크 시 브라우저가 필드를 아예 안 보내므로 `undefined` 도 걸러야 한다
- 🔴 **연령을 검증할 수단은 없다 — 그래서 "진술 + 신고 경로" 조합이다.**
  본인확인(휴대폰·아이핀)은 개인정보를 더 모으게 되고, 생년월일도 결국 자기 신고다.
  처리방침에 **"연령을 별도로 검증하지 않는다"** 를 밝히고 법정대리인 신고 창구를 명시했다 —
  그래야 약관 4항의 사후 조치("확인되는 경우 삭제")가 말뿐이 아니게 된다
- ⚠️ 연령대 선택지 첫 항목이 `14~19세` 인 것도 같은 장치다 (14세 미만은 고를 항목이 없다)

- 🔴 **만 14세 미만 정책** — 법정대리인 동의 절차(개인정보 보호법 제22조의2)를 구현하는 대신
  **가입 자격 제한**을 택했다 (2026-08-16 사용자 결정). 연령대 선택지 첫 항목을 `10대` → **`14~19세`**
  로 바꾼 것도 이 때문이다. 되돌리려면 동의 절차를 먼저 만들어야 한다
- 🔴 **면책은 "고의 또는 중대한 과실" 예외를 반드시 남긴다** (3항). 전면 면책은 약관규제법 제7조로
  **무효**가 될 수 있고, 그러면 면책이 통째로 사라져 더 위험하다
- 🔴 **11항 약관의 변경** — 이 조항이 없으면 **개정 약관을 적용할 근거가 없다.**
  시행 7일 전 공지(불리한 변경은 30일) + 계속 이용 시 동의 간주
- ⚠️ **5항 게시물 이용허락**은 범위를 적는다 (무상·비독점, 서비스 내 표시·홍보 범위).
  범위 없이 "사용할 수 있습니다" 만 쓰면 광범위한 저작권 양도로 읽혀 불공정 조항이 된다
- ⚠️ **6항 크롤링 금지는 `robots.txt` 와 맞춰야 한다** — 검색봇은 의도적으로 허용 중이라
  전면 금지로 쓰면 어긋난다 (예외 문구 있음)
- ⚠️ **10항 광고** — "정치 관련 광고 카테고리를 차단" 은 **실행이 전제된 약속**이다.
  AdSense 승인 후 콘솔에서 실제로 차단을 걸어야 이 문장이 사실이 된다
- ⚠️ 2항 서비스 내용은 기능이 늘면 같이 갱신할 것 (브리핑·차트 만들기가 빠져 있었다)

### 화면 문구는 한글로 (2026-08-16)
🔴 **불필요한 영어 라벨을 쓰지 말 것.** 장식으로 넣은 영어는 읽는 사람에게 정보를 주지 않는다.

전 페이지를 훑어 12곳을 한글로 바꿨다:
`BRIEFING`→브리핑 · `MAKE A CHART`→차트 만들기 · `TABLE OF CONTENTS`→목차 ·
`SEAT DISTRIBUTION`→(제거) · `TOP 5/10`·`BOTTOM 5`→상위/5곳 · `Phase 2`→준비 중 ·
`mapping v1`→매핑 v1 · `mapping_version`(DB 컬럼명이 화면에 노출)→매핑 버전 ·
용어 설명의 `BILL_RESULT`·`PROPOSER`·`VOTE_RESULT`·`GLOSSARY` kicker 제거

- ⚠️ **남겨야 하는 영어**: 고유명사(`Supabase`·`Railway`·`Claude`)와 정착된 용어
  (`AI`·`ETF`·`ESG`·`ICT`·`GSOMIA`·`R&D`) — 억지로 옮기면 오히려 못 알아본다
- ⚠️ 데이터에서 오는 영어(의원 이메일 도메인 등)는 손대지 않는다
- 점검법: 렌더된 HTML 에서 `<script>`·`<style>`·주석을 걷어내고 영문 낱말을 뽑아 본다
  (페이지별로 돌려 `OK` 가 나오는지 확인)

### 브라우저 타이틀 규약 (2026-08-10)
```
홈       →  당말사 — 당 말고 사람
그 외    →  {페이지 이름} · 당말사 — 당 말고 사람
```
- **조립은 `views/layout.ejs` 의 `<title>` 한 곳에서만** 함
- 컨트롤러/라우트의 `pageTitle` 은 **페이지 이름만** 넘길 것 (`'법안'`, `'개인정보처리방침'`, `bill.bill_name`).
  브랜드명·태그라인·구분자를 직접 붙이지 말 것 — 붙이면 `법안 - 당말사 · 당말사 — 당 말고 사람` 처럼 중복됨
- 홈(`InitController`)은 `pageTitle: null` 을 넘겨 브랜드+태그라인 단독으로 렌더
- 페이지 내 계층이 필요하면 `·` 사용 (`'글쓰기 · 커뮤니티'`)
- 길이 실측: 대부분 18~24자, 최장은 법안 상세 34자 (법안명이 길어서) — 탭·SERP 모두 문제없음

---

## Claude Code 빠른 시작

```bash
# 서버 로컬 실행
npm start          # ← 현재 동작하는 명령

# ⚠️ `npm run dev` 는 지금 실패한다 — nodemon 이 설치돼 있지 않다 (package.json 에 devDependencies 자체가 없음).
#    자동 재시작을 쓰려면 먼저: npm i -D nodemon
# ⚠️ 컨트롤러·라우트·서비스(.js)를 고치면 반드시 재시작해야 반영된다. EJS·CSS 는 요청마다 다시 읽어 재시작 불필요
# ⚠️ Windows 에서 서버를 죽일 땐 Git Bash 의 `pkill -f "node app.js"` 가 **안 먹는다**.
#    PowerShell `Stop-Process` 를 쓸 것 — 안 그러면 옛 프로세스가 포트를 잡은 채 응답해서
#    "코드가 반영이 안 된다" 로 오진하게 된다 (실제로 겪음)

# 배치 실행 예시 (순서: 의원 → 법안 → 표결. "배치 실행 순서" 섹션 참조. Node 22 필수)
node batch/syncPoliticians.js
node batch/syncBills.js
node batch/syncBillSummary.js          # 제안이유·주요내용 (증분. 전건 백필은 --full, 약 8분)
node batch/syncVotes.js

# AI 분석
node batch/syncBillAiAnalysis.js                                # Phase 1 가결 + 미분석 3건
node batch/syncBillAiAnalysis.js --limit 50                      # 50건
node batch/syncBillAiAnalysis.js --bill-id PRC_X2Y... --bill-id PRC_A2B...   # 특정 법안
node batch/reclassifyCategories.js --dry-run                     # 카테고리 재분류 미리보기
node batch/reclassifyCategories.js                               # 실행

# 밸런스 게임
node batch/calcGroupAxisAvg.js                                   # 인구 그룹별 평균 (매일 새벽)
node batch/calcPoliticianAxis.js                                 # 의원 좌표 v2 (공동발의 × 매핑, 3축) — 매일 체인에도 포함
node batch/mapBillAxisPilot.js --dry-run                          # 법안-축 AI 매핑 (형식 확인) · 실제 확장은 --target/--max-candidates
```
