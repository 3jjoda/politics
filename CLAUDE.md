# 3jjoda 프로젝트 — Claude Code 컨텍스트
> 마지막 업데이트: 2026-08-06
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
--text:    #1A1D24 / --sub: #4B5362 / --sub2: #7A8090
--accent:  #B8740C    브랜드 골드 (활성/버튼/링크)
--accent2: #925C09    호버
--green:   #0F9D6E / --red: #D03A3A / --purple: #7C3AED   # 객관 데이터 (본회의 가결/부결) 전용
--vote-pro: #7499B4 / --vote-con: #B48E74                  # 국민 찬반 — 등명도(L=58%) 등채도(S=30%), cool/warm 두 hue. 글자는 차콜 (2026-04-26)
--nav-h:   60px       고정 nav 높이
```
- 폰트: Noto Sans KR 15px/1.75, `word-break: keep-all`
  - **Noto Serif KR 900** (2026-04-24 추가) — 법안 분석 Zone 1 한 줄 요약·Zone 4 판단 질문 전용
- 공통 CSS: `public/styles/main.css` (`.pb-*` prefix)

### 공용 페이지 헤더 `.pb-page-header`
`main.css` 에 정의된 섹션 타이틀 블록. 모든 목록/랜딩 페이지가 동일 컨셉으로 쓰도록 통일.
- 트릭: `margin-top: calc(-1 * var(--nav-h))` + `border-top: var(--nav-h) solid transparent` — 그라디언트 배경이 고정 nav 뒤까지 바닥부터 뻗음
- 내부: `.pb-page-header-inner { flex; justify-content: space-between; align-items: flex-end }` — 좌측 `.pb-page-title` (Bebas Neue 44px) + `.pb-page-desc` (desc 14px), 우측에 액션 버튼(예: 커뮤니티 글쓰기) 배치 가능
- 적용 페이지: `/bill`, `/politician`, `/glossary`, `/community`, `/about`
- Breadcrumb 정책: **목록/랜딩은 미노출** (nav 의 active 상태로 충분), 상세/sub 페이지(`/bill/:id`, `/politician/:id`, `/community/:id`, `/community/write`) 만 노출
- Wrapper padding 통일: page-header 를 쓰는 페이지의 본문 wrapper 는 `padding: 36px 24px 80px` (nav 오프셋은 header 가 처리), page-header 없는 페이지(`bill_detail`, `community/detail`, `community/write`) 는 `padding: calc(var(--nav-h) + 36px) 24px 80px` 로 직접 처리

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
- `politician_party_memberships` — 의원-정당 이력
- `briefing_posts` — **브리핑 카드** (2026-08-11, `genBriefing.js`). `briefing_date` UNIQUE 라 하루 1장.
  `stats`(SQL 집계) · `threads`(주제 묶음, v2) · `keywords` · `bill_ids` JSONB. 상세는 아래 "`/briefing` AI 카드 피드"
  - ⚠️ `id` 가 **연속하지 않는다** — `GENERATED ALWAYS AS IDENTITY` 가 ON CONFLICT 판정 전에 값을 뽑아 `--force` 재실행이 시퀀스를 태운다
  - ⚠️ `stats`·`threads[].bill_count` 는 **AI 출력이 아니라 SQL/코드 산출값**이다 (숫자를 생성물에서 받지 않는다는 원칙)
- `politician_titles` — **의원 특수 직위** (2026-08-12 신규). 의장단·국무위원·교섭단체·당직 4종. **전부 수동 입력** (`ddl/seeds/politician_titles.sql`) — 자동 수집 경로가 없다. 상세는 아래 "특수 직위 배지" 참조. ⚠️ 상임위 직위는 여기가 아니라 `politician_committees`
- `politician_committees` — **위원회 위원 명단** (2026-08-12 신규, `syncCommittees.js`). 실측 477행 / 23개 위원회 / 의원 298명(1~6개 중복 소속) / 미소속 11명
  - 소스 `nktulghcadyhmiqxi` 가 **`MONA_CD` 를 직접 준다** — 이름 매칭이 필요 없다 (발언영상 API 는 이름 문자열만 줘서 파싱이 필요한 것과 대조)
  - ⚠️ **현재 스냅샷이지 이력이 아니다.** API 에 대수·기간 인자가 없다. 배치가 매번 전체 교체하므로 "과거에 어느 위원회였나" 는 답할 수 없다. 이력이 필요하면 별도 테이블을 만들 것 — 이걸 UPSERT 로 바꾸면 사임한 위원이 영원히 남는다
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
  - `ddl/migrations/2026-08-12-supabase-data-api-off.sql` — **Supabase Data API 노출 차단**. 실행할 SQL 이 아니라 **대시보드 설정의 기록** + 검증 쿼리 + 폴백 RLS 스크립트. ⚠️ DB 재생성 시 반드시 재설정 (빠뜨려도 에러 없이 전 테이블이 인터넷에 열림). 위 "Supabase Data API 는 꺼져 있다" 참조
- `etc/ddl/seeds/` — 데이터 시드
  - `bill_axis_mapping_v1.sql` — 법안-축 매핑 v1 (AI 1차 매핑 48건, 사용자 1라운드 검토 반영). 비공개 매핑이라 UI 노출 X. `batch/calcPoliticianAxis.js` 입력 데이터. `BILL_AXIS_MAPPING_GUIDE.md` / `BILL_AXIS_MAPPING_v1_REVIEW.md` 같이 참조
- `balance_game_seed_v1.sql` (root) — 밸런스 게임 60문항 시드 (종합 20 + 노동 10 + 부동산 10 + 안보 10 + 젠더 10). 별도 받아온 외부 시드 파일이라 root 에 위치

---

## 라우트 구조

### 페이지 (EJS 렌더링)
| 경로 | 뷰 | 설명 |
|---|---|---|
| `/` | `views/index.ejs` | 홈 (KPI, 주목 법안, 최근 표결, 최근 정당 이동, 활발 의원, 월별 추이) |
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
| `/my` | `my/profile.ejs` | 마이페이지 (`requireLogin`) — 프로필 / 성향 카드 / 풀이 이력 / 분석 요청 요약 |
| `/my/analysis-requests` | `my/analysis_requests.ejs` | 마이페이지 — 내가 요청한 AI 분석 (`requireLogin`) |
| `/balance-game` | `balance/invite.ejs` | 성향 진단 — 게임팩 컬렉션 (입문 게임팩 + 주제팩 placeholder) |
| `/balance-game/respond` | `balance/respond.ejs` | 단계 2 응답 (한 화면 한 문항, 즉시 서버 저장, 이어하기, 키보드 1·2·3·←) |
| `/balance-game/reveal` | `balance/reveal.ejs` | 단계 3 펼침 — 13초 클라이맥스 애니메이션, 다이아몬드 + 카드 메타 |
| `/balance-game/compare` | `balance/compare.ejs` | 단계 4 비교 — 분포 다이아몬드 + 토글(전체·인구그룹·의원) + 임계값 처리 |
| `/balance-game/connect` | `balance/connect.ejs` | 단계 5 연결 — D 레이어 안내 + 출구 5종 |
| `/balance-game/mapping` | `balance/mapping_preview.ejs` | 매핑 미리 보기 (DB 조회, 게임팩별 섹션) |
| `/auth/welcome` | `auth/welcome.ejs` | 가입 직후 환영 페이지 (1회 노출, [지금 풀기]/[둘러보기]) |
| `/admin/titles` | `admin/titles.ejs` | **관리자 — 의원 직위 관리** (`requireAdmin`). 수동 직위 CRUD + 재확인 상태 |
| `/about` | `about.ejs` | 사이트 소개 |
| `/privacy` | `privacy.ejs` | 개인정보처리방침 (2026-07-29, AdSense 대비 광고 쿠키 조항 포함) |
| `/terms` | `terms.ejs` | 이용약관 (AI 분석 면책·게시물 정책) |
| `/glossary` | `glossary.ejs` | 용어 설명 (목차 + 4섹션) |
| `/auth/login` | `auth/login.ejs` | 구글/카카오 로그인 |
| (404/403) | `error_pages/404.ejs` | 찾을 수 없음·권한 없음 공용. `{ pageTitle, pageStyles:'error', message, code?, detail? }` — `code` 생략 시 404 |
| (500) | `error_pages/500.ejs` | 전역 에러 핸들러 전용. locals 의존 최소화 (에러 처리 중 렌더라 실패하면 안 됨) |
| `/auth/setup` | `auth/setup.ejs` | 신규 OAuth 닉네임·성별·연령대 설정 (필수) |

### `/bill/:id` 5-Zone AI 분석 UI (2026-04-27 전면 리디자인)
`bill_ai_analysis` 테이블에 레코드가 있을 때만 5-Zone 렌더. 없으면 `.bill-basic-header` (옛 디자인 — 메타 + 법안명) + **법안 원문 섹션** + 분석 요청 위젯 노출.

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
  - **발의자 컴팩트 스택** (`.ba-proposers`, 2026-04-27 신규):
    - 좌: 가로 아바타 스택 (대표 32px·골드 외곽선 / 그 외 24px·overlap), 최대 10명
    - 가운데: `{대표명} 외 N인 · {정당분포}` 라벨 (1정당이면 "모두 X", 다정당이면 "X 7, Y 3")
    - 우: "전체 보기 ▾" 토글 → 5열 카드 그리드 펼침 (대표 카드만 골드 외곽선 + 작은 "대표" 라벨)
    - 정당색 사용 안 함 (정치색 회피). 강조는 골드 단일색
    - 모바일 ≤768: 아바타 축소(28/22), 라벨·토글 다음 줄, 그리드 5→2열
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
- **Zone 9 — 본회의 표결** (`#part-floor-vote`): 데이터 없을 때 italic `#9B9486` empty state. 있을 때 4-박스 vote-dashboard 톤만 통일 (정당색은 객관 데이터라 그대로)
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
- **그룹 추가** = `XRAY_GROUPS` 에 한 줄
- 둘 다 `xray.ejs` 는 안 건드린다
- 번호(`no`)는 **그룹 순서 → 그룹 내 순서**로 자동 부여. 어디에 끼워넣어도 손댈 곳이 없다
  (이전엔 gapdist 를 3번에 넣느라 기존 03~10 을 04~11 로 전부 밀어야 했다)
- `group` 오타로 어느 그룹에도 안 걸리면 **"기타" 그룹으로 노출 + 경고 로그**. 조용히 사라지지 않는다

**그룹 5종 · 섹션 12개**: 표결(합의분포·당론이탈·불참률) / 발의(발의왕vs입법왕·초당협력·발의스타일) /
법안(생존율·**월별추이**·AI카테고리) / 성향(당성향격차·성향스펙트럼) / 국민(국민vs국회)

> ⚠️ **월별 추이(`monthly`) 는 처리 지연을 반드시 같이 보여줄 것.**
> 최근 달일수록 처리 완료가 0 에 수렴한다 (실측: 2026-05 발의 254건 중 처리 1건, 최근 6개월 3.3%).
> "가결률"만 그리면 국회가 갈수록 일을 안 하는 것처럼 보이지만 **아직 심사 중일 뿐**이다.
> 진행 중인 달(`isPartial`)은 막대를 흐리게 + 꺾은선·평균 통계에서 제외한다.

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
# → out/insta/<YYYY-MM-DD>/01.png … NN.png + caption.txt
```
- **의존성 0개.** Playwright·Puppeteer 는 크로미움을 따로 받는데(~150MB), 이건 **로컬 전용 운영 도구**라
  (Railway 에 올릴 일이 없다) 이미 깔린 브라우저에 인자만 넘긴다. 윈도우는 Edge 가 항상 있어 사실상 늘 걸린다
- 전제: **서버가 떠 있어야 한다** (`npm start`). 페이지를 실제로 렌더해 찍는 방식
- 슬라이드 수는 **카드 페이지 HTML 에서 센다** (`data-slide=` 개수). 배치가 다시 계산하면 컨트롤러와 어긋난다
- ⚠️ `--force-device-scale-factor=1` 필수 — 고DPI 장비에서 2160×2700 으로 찍히는데
  **인스타가 알아서 줄여줘서 눈으로는 멀쩡해 보인다.** 그래서 PNG 헤더로 크기를 매번 검증한다
- ⚠️ `--virtual-time-budget=6000` 필수 — 없으면 웹폰트 로드 전에 찍혀 폴백 폰트로 나온다
- `caption.txt` 도 같이 쓴다 — **그대로 복사해 인스타 캡션 칸에 붙여넣는 텍스트**
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
- 실측: 6장 6초. 카드 6건 38장 전부 1080×1350 경고 0
- 산출물 `out/` 은 `.gitignore` — 생성물이라 추적하지 않는다

- 손으로 뽑을 땐 **DevTools 의 `Capture node screenshot`**. 창 캡처는 화면 배율·DPI 를 타서 1080px 이 안 나온다
- 링크는 `res.locals.isAdmin` 일 때만 상세 페이지에 노출. **라우트 자체는 막지 않았다** —
  같은 공개 데이터를 다르게 그린 것뿐이고, 막으면 로그인 상태에 따라 미리보기가 안 되는 상황이 생긴다 (`noindex` 는 걸어둠)
- ⚠️ **AI 고지·출처 표기가 마무리 장에 반드시 있어야 한다.** 카드는 사이트 밖으로 나가므로 여기가 유일한 고지 지점이다

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
  - ⚠️ **서버에 gzip 압축이 없다** (`compression` 미사용). 붙이면 이 페이지가 ~25KB 로 떨어지고 `/bill`·`/xray` 등 **전 페이지가 같이 좋아진다.** 발의 건수가 크게 늘면 `/xray` 처럼 조각 지연 로딩으로 바꾸는 것도 대안
- nav 위치: **홈 다음** (진입점 성격). nav 는 2행 구조라 9개가 되어도 여유 685px (1280px 기준)
- ⚠️ 서비스·컨트롤러(`.js`) 수정은 **서버 재시작** 해야 반영된다 (EJS 는 즉시). 그룹 정렬을 고치고 안 바뀌길래 한 번 헛짚었다

### `/politician/:id` 페이지 구조 (2026-04-25 재편)
- **히어로**: breadcrumb → `.profile-identity` (아바타 240px + 이름·정당배지·메타) → `.profile-subinfo` (생년월일·성별 / 이메일 / 홈페이지·국회프로필 — flex-wrap, 이메일만 `.full` 로 단독 행). 카드 박스 없이 hero 배경에 자연스럽게 녹아듬
- **탭**: `[분석(기본), 법안 활동, 표결 내역, 국민 평가]`
- **분석 탭** (기본 활성): KPI 행(발의·표결참여·가결율) → `overview-grid` 3카드(활동 레이더 / 표결 성향 / 관심분야 TOP 5) → `overview-grid.two` (월별 발의 + 정당별 공동발의 협력 | 주요 법안 이력 타임라인). "숫자 요약 → 시각화 → 시계열·관계" 흐름

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
  - 필터 시트 배지 카운트에는 미포함 (상단 드롭다운이라 `match` 와 동일 취급)
- **숫자로 본 국회 「당을 보나, 법안을 보나」** (`#xr-gapdist`, 2026-08-05): 개인 순위("266명 중 42위")의 배경이 되는 **전체 분포**
  - 쿼리 2개 — `getCrossPartyGapDist.sql` (2%p 폭 17구간 `width_bucket`, -2~32) / `getCrossPartyGapStats.sql` (사분위·중립/당파 인원·정당별 평균). 둘 다 MV 를 읽어 300행 스캔
  - 서비스 `buildGapDist()` 가 빈 버킷을 채움 — 안 채우면 분포 모양이 왜곡된다
  - 히스토그램에 **중앙값 점선** 오버레이. 10%p 이상 구간만 진하게 (합의 분포의 90% 강조와 같은 패턴)
  - 실측: 중앙값 3.4%p / 2%p 미만 100명(37.6%) / 10%p 이상 29명(10.9%) / 범위 -1.2~30.9
  - **정당별 평균 격차(국힘 7.4 · 민주 2.5)는 해석 주의 문구와 반드시 세트** — 다수당은 자기 법안이 무난히 통과되는 의사일정 구조라 격차가 낮게 나오는 경향. "어느 당이 더 당파적" 으로 읽히면 중립성 원칙 위반
  - 섹션 번호가 밀려 기존 03~10 → 04~11 로 재정렬됨 (`SECTIONS` 배열 + `.xr-no` 라벨)
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
| DELETE | `/api/auth/withdraw` | 회원 탈퇴 (익명화) |
| GET / POST / PUT / DELETE | `/api/comments[/:id]` | 댓글 CRUD (소프트 삭제, 대댓글 1단계) |
| GET / POST | `/api/ratings/politician/:monacd` | 별점 조회/UPSERT |
| GET / POST | `/api/votes/bill/:billId` | 국민 찬반 조회/UPSERT |
| GET / POST | `/api/likes` | 좋아요 토글/카운트 |
| GET | `/api/bills/search?q=X` | 법안 검색 (커뮤니티 첨부용) |
| GET | `/api/bills/trending?sort=recent\|close\|popular\|bipartisan` | 홈 주목할 법안 (정렬 탭 동적 교체) |
| GET | `/api/bill/:id/analysis-status` | AI 분석 요청 상태 `{count, hasRequested, threshold}` |
| POST | `/bill/:id/request-analysis` | AI 분석 요청 (requireLogin, 멱등). `ALREADY_ANALYZED` 면 400 |
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
- 상태 탭 카운트(`getStatusCounts`)도 committee/party 필터 모두 반영하여 탭 숫자 일관성 유지
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
- `.sheet-pending` CSS 전역. 서버렌더 `.active` 는 JS init 에서 제거 후 `.sheet-pending` 으로 교체

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
  - **의원 상세 "당신과의 비교" 펼침 컴포넌트** (객관 착시 방지·D 레이어 본체, 2026-04-26):
    - 위치: KPI 행 바로 아래 (`#tab-overview` 안). 이전 "일치도 한 줄"(`profile-match-row`) + "비교 섹션"(`bg-vs-section`) 둘 다 흡수
    - **헤더** (`bg-vs-collapse-header`, 항상 노출, 골드 톤 그라디언트): "나의 성향 진단과 **N%** 일치 · 매핑 v1 → · ▼"
      - 매핑 링크는 `stopPropagation` 으로 토글과 분리 (`/balance-game/mapping`)
      - 헤더 클릭 시 바디 토글 (`data-open` true/false 스왑, ▼ 90도 회전 + max-height 0.3s 애니메이션)
    - **바디** (`bg-vs-collapse-body`, 첫 진입 자동 펼침): flex column 가운데 정렬 — 다이아몬드 위 → border-top → 축별 해석 4줄 아래 (max-width 520px). 헤더에 이미 일치도 % 가 있어 **전체 일치도 박스는 제거** (헤더=결론, 바디=분해, 결론 반복 X)
    - 다이아몬드 (reveal/compare 패턴): 사용자 골드 + 의원 회색 점선 두 polygon 겹침. 좌표 수치는 SVG `<title>` 호버 툴팁 (라벨 겹침 회피). 일치도(%) = `max(0, (1 - d/1.5) × 100)`
    - 축별 해석 (Noto Serif KR): 강도 4단계 (`<0.25 거의 같음 / 0.75 약간 / 1.25 뚜렷 / 그 이상 정반대·큰 차이`) × 방향 (`같은 방향 (둘 다 {SIDE} 쪽) / 반대 방향 / 한쪽 중도 근처`). SIDE: economy 시장/개입, social 전통/자율, security 동맹/자주, institution 안정/개혁
    - **Fallback** (펼침 비활성, 헤더만 회색):
      - 미완료 유저 → `is-pending` "성향 진단 후 표시됩니다 / 진단하러 가기 →" `/balance-game?next=` 복귀
      - 미산출 의원 (1명) → `is-missing` "⚠️ 분석 데이터 부족 / 표결 참여 부족"
    - 반응형: 데스크톱 320px 다이아몬드 + 1fr 해석 (2열) / 모바일 ≤768px 1열
  - **의원 페이지 일치도 필터·정렬** (D 레이어 본체, 2026-04-26):
    - `#pol-match-filter` 드롭다운: 전체 / 70%·60%·50% 이상 / 50% 미만 (5옵션). 미완료 유저는 `disabled` + tooltip "성향 진단 후 활성됩니다"
    - `#pol-sort` 추가 옵션: `match-desc` (일치도 높은 순) / `match-asc` (일치도 낮은 순 — 정반대 의원 발견). 미완료 유저는 option `disabled`
    - 좌표 미산출 의원: 필터 적용 시 제외 / 정렬 시 항상 마지막
    - **URL 영속화**: `loadFromUrl()` / `saveToUrl()` history.replaceState (클라이언트 사이드 reload 없음). 키: `party`, `committee`, `elect`, `sex`, `age`, `q`, `sort`, `match`. 배열은 쉼표 구분
    - `data-match-pct` 속성으로 카드별 일치도(%) 서버 사전 계산 → JS 필터/정렬에서 즉시 사용
  - 의원 카드 D 레이어 (politician.ejs 그리드·리스트 + politician_detail.ejs + balance/connect.ejs 미리보기):
    - 거리 = `sqrt(Σ(u.axis - p.axis)²) / 2`. 일치도(%) = `max(0, (1 - d/1.5) × 100)` — 분모 1.5 (실측 거리 분포 보정, "겹치는 정도 = % 일치도" 직관 정합). 실측 [0.61, 1.49] → [1%, 59%]
    - **텍스트 통일**: `"나의 성향 진단과 N% 일치"` 한 줄. 모든 의원 동일톤 (이모지·라벨·거리값·v1 메타·tier 차등·골드 강조 모두 제거)
    - 두 라운드 연속 "차등 잘 안 보임" 피드백 → 시각 차등 자체가 정보 전달 못 한다고 결론. % 숫자 자체로 강도 명확
    - **위치** ("정체 → 활동 → 분석"): 그리드 카드는 `pol-overlay > pol-stats-line` 아래 (발의·공동 카운트 바로 아래) / 상세 페이지는 KPI 행 아래 (`profile-match-row` 카드형, 우측에 `매핑 v1 →` `/balance-game/mapping` 링크)
    - 호버/탭 툴팁: `"당신 좌표와 4축 거리 N.NN. 매핑 v1 기준."`
    - 미완료/비로그인 → `"진단 후 일치도 표시"` (회색·이탤릭). 상세는 `<a href="/balance-game">` 카드 전체 클릭
    - 분위수(`userDistanceQuartiles`) 미들웨어 인프라는 유지 — UI 차등은 안 쓰지만 향후 단계 5 "비슷한 의원 TOP 3" 등에서 재사용
    - `getListWithStats.sql` / `getDetail.sql` 가 `LEFT JOIN politician_axis_score (mapping_version='v1')` 로 axis_* 컬럼 노출. 좌표 미산출(표결 1건 미만) 1명은 일치도 미표시 (배지 자체가 안 나옴)
    - 컴포넌트: `.pol-match-line` (그리드+리스트) / `.profile-match-row` (상세) / `.bg-d-card-preview .pv-match` (connect 미리보기)

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
| `syncCommittees.js` | 열린국회정보 (`nktulghcadyhmiqxi`) | 위원회 위원 명단 → `politician_committees`. **전체 교체**(스냅샷) · `--dry-run`. 실측 477행 0.65초 |
| `syncPhotos.js` | 크롤링 | 의원 프로필 사진 |
| `updateCommittee.js` | 열린국회 API | `syncBills.js` 이전 레코드 committee 컬럼 보강 (pSize=1000, bulk VALUES UPDATE) |
| `syncBillAiAnalysis.js` | pal.assembly.go.kr 크롤 + Claude Haiku 4.5 | AI 법안 분석 (v4.1, 16종 카테고리) |
| `reclassifyCategories.js` | Claude Haiku 4.5 | 자유 카테고리 → v4.1 16종 main+sub 일괄 재분류 |
| `billCategories.js` | (모듈) | 16종 카테고리·정의·tie-breaker 공유 (분석/재분류 배치가 import) |
| `calcGroupAxisAvg.js` | DB 집계 | 인구 그룹별 4축 평균 일배치 (밸런스 게임 단계 4 비교용). 'all' + (gender × age_group), user_count >= 50 만 평균 채움 |
| `calcPoliticianAxis.js` | DB 집계 | `bill_axis_mapping × bill_votes` → `politician_axis_score`. 가중평균 (찬성→agree_score / 반대→disagree_score, 기권/불참 제외). 인자 `--version v1` `--min-votes 1`. 분포 히스토그램 + 정당별 평균 검증 출력 |
| `refreshCrossPartyVote.js` | DB 집계 | `politician_cross_party_vote` MV 갱신 (`REFRESH ... CONCURRENTLY`, ~0.4초). 의원 목록의 격차 필터·정렬이 이걸 읽는다. **syncBills·syncVotes 다음에 실행** |
| `refreshDissent.js` | DB 집계 | `politician_dissent` MV 갱신 (`REFRESH ... CONCURRENTLY`). "숫자로 본 국회"의 소신 표결이 이걸 읽는다. **syncPoliticians·syncVotes 다음에 실행** |
| `genBriefing.js` | 그날 법안 전건 + Claude Haiku 4.5 | 브리핑 카드 생성 (v2 프롬프트, 주제 묶음). 하루 1콜 · `--date` `--limit` `--force` `--dry-run`. `START_DATE`(2026-08-13) 이후 · 주말 제외 · 활동 없는 평일은 `model='none'` 카드. **체인 맨 뒤** — 그날 법안·요약이 다 들어온 뒤 읽는다 |
| `genInstaCards.js` | 헤드리스 브라우저 | **인스타 캐러셀 PNG + 캡션** 생성 (`npm run insta`). `--id` `--date` `--out` `--base`. **로컬 전용** — 크론 체인에 넣지 않는다 |

### 배치 실행 순서 (2026-07-29 정리)
> ⚠️ 실행 전 `node -v` 확인 — **Node 22** (`.nvmrc` 22.20.0). Node 18 이면 undici 7 이 전역 `File` 부재로 즉사 (`ReferenceError: File is not defined`)

**정기 갱신 (의존 순서 고정)**:
```
1. syncPoliticians.js    # 의원 마스터
1-1. syncCommittees.js   # 위원회 위원 명단 — politicians 다음 (mona_cd 조인 대상)
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
| `calcPoliticianAxis.js` | `bill_axis_mapping` 시드 변경 또는 syncVotes 갱신 시 |

**일회성 (완료, 재실행 불필요)**: `updateCommittee.js` (구레코드 committee 보강), `reclassifyCategories.js` (v4→v4.1 재분류 — 카테고리 체계 변경 시에만)

### 크론 배포 (Railway, 2026-08-04)
npm 스크립트로 체인을 고정 — Railway Start Command 는 이걸 부르기만 한다.
- `npm run batch:daily` — `syncPoliticians && syncCommittees && syncBills && syncBillSummary && syncVotes && refreshCrossPartyVote && refreshDissent && calcPoliticianAxis && calcGroupAxisAvg && genBriefing`
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
  선거기간에는 공직선거법상 광고 규제도 걸릴 수 있으므로 그 시기엔 정치 카테고리 차단 상태를 재확인
- **CMP(GDPR 동의 배너)**: Google 인증 CMP 중 **3가지 선택(동의 / 동의하지 않음 / 옵션 관리)** 채택.
  첫 화면에 거부 버튼이 없는 2가지 선택안은 동의율이 높지만 EEA 트래픽이 사실상 0이라 얻을 게 없고,
  투명성 브랜드와도 맞지 않아 제외. **코드 작업 없음** — `adsbygoogle.js` 가 알아서 배포하고,
  한국 방문자에겐 배너가 뜨지 않는다 (EEA·영국·스위스 한정)

### 진행 상태 (2026-08-10)
소유권 확인 ✅ · 검토 요청 ✅ · CMP 설정 ✅ → **심사 대기 중** (며칠~2주, 결과 메일).
승인 후 액션은 위 "정치 중립성 리스크" 항목.

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
- **nav 로고: `[mark-only.svg + wordmark-nav.svg]` │ `tagline.svg` 가로 락업** — 데스크톱 225×36 (마크 36 · 워드마크 h30 · 구분선 1×20 · 태그라인 h18) / 모바일 ≤768 183×30 (30 · h24 · 1×16 · h15). CSS `.pb-logo` > `.pb-logo-brand`(`.pb-logo-mark` + `.pb-logo-wordmark`) + `.pb-logo-div` + `.pb-logo-tagline-img`
- **login 카드: nav 와 같은 3에셋 조립** — 락업 161×84 (마크 48 · 워드마크 h40 가로배치 / 태그라인 h24 아래). 카드는 세로 여유가 있어 태그라인을 아래로 내리고 배율만 키움. CSS `.auth-logo` / `.auth-logo-brand` / `.auth-logo-mark` / `.auth-logo-wordmark` / `.auth-logo-tagline` (login.ejs 인라인)
- 파비콘: `favicon.ico`, `favicon-16.svg`, `favicon-32.svg`, `apple-touch-180.png`
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
node batch/calcPoliticianAxis.js                                 # 의원 4축 좌표 (mapping/표결 변경 시)
```
