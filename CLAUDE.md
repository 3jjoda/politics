# 3jjoda 프로젝트 — Claude Code 컨텍스트
> 마지막 업데이트: 2026-04-27
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

## 서비스: 정치 바로미터

### 철학
"더 이상 당만 보고 투표하는 사람이 없도록"
내가 행한 한 표가 어떻게 나라를 굴리고 있는지 끝까지 지켜볼 수 있는 플랫폼.

### 레포 & 배포
- GitHub: https://github.com/3jjoda/politics (dev 브랜치)
- 배포: https://politics-production.up.railway.app
- DB: Supabase PostgreSQL (Transaction Pooler, ap-northeast-1)

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
--vote-pro: #7499B4 / --vote-con: #B48E74                  # 시민 찬반 — 등명도(L=58%) 등채도(S=30%), cool/warm 두 hue. 글자는 차콜 (2026-04-26)
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
  - ⚠️ **현직 22대 의원만 저장** (2026-04-24 현재 295명). `syncPoliticians.js` 가 열린국회 "현역 의원 API" 기반이라 중도 퇴임·사직·당선무효·사망·승계 등으로 빠진 ~11명은 미포함
  - 결과: `bill_votes` / `bill_co_proposers` 에 해당 mona_cd 기록은 남아있지만 JOIN miss → 이름·정당·사진 렌더 불가. UI 는 "(퇴임)" fallback 으로 처리 (voter-list / proposer-chip)
  - 근본 해결은 "역대 국회의원 API" 전환 — [ROADMAP.md](./ROADMAP.md) 베타 오픈 전 필수 3번
- `politician_party_memberships` — 의원-정당 이력
- `bills` (PK bill_id VARCHAR), `bill_co_proposers`, `bill_votes` — 법안·발의자·표결
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
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('politician','bill','post')),
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

-- 좋아요 (토글, 댓글·게시글 공용)
CREATE TABLE likes (
  id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('comment','post')),
  target_id   VARCHAR(50)  NOT NULL,
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
- 모호 케이스 결정 가이드: 직접적 변경 대상(수단보다 결과) → 주관 부처 → 일반 시민 검색 멘탈모델 순. 예: "환경교육법 → 환경·에너지", "소상공인 지원법 → 노동·고용", "양자과학기술법 → 산업·R&D"
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
- `users_update.sql`, `comments.sql`, `politician_ratings.sql`,
  `bill_citizen_votes.sql`, `likes.sql`, `posts.sql`, `user_session.sql`,
  `bill_ai_analysis.sql` (2026-04-24 신규 — 샘플 INSERT 포함),
  `bill_analysis_requests.sql` (2026-04-25 — 분석 요청 테이블 + view)
- `etc/ddl/migrations/` — 누적 변경
  - `2026-04-26-bill-category-tier.sql` — `bill_ai_analysis` 에 `category_main`/`category_sub` 컬럼 추가
  - `2026-04-26-balance-game.sql` — 밸런스 게임 4테이블 1차 (이후 cumulative 마이그레이션이 응답 테이블 재설계)
  - `2026-04-26-balance-game-cumulative.sql` — **누적 모델 v2**. `balance_game_packs` / `user_axis_score` / `group_axis_avg` 신규, `balance_game_responses` 1문항 단위 재설계, `balance_game_questions` 에 `pack_id`/`display_order`, `bill_axis_mapping.mapped_by` 타입 변경, `users.welcomed_at`. 종합팩 'general' + 20문항 시드 포함
- `etc/ddl/seeds/` — 데이터 시드
  - `bill_axis_mapping_v1.sql` — 법안-축 매핑 v1 (AI 1차 매핑 48건, 사용자 1라운드 검토 반영). 비공개 매핑이라 UI 노출 X. `batch/calcPoliticianAxis.js` 입력 데이터. `BILL_AXIS_MAPPING_GUIDE.md` / `BILL_AXIS_MAPPING_v1_REVIEW.md` 같이 참조
- `balance_game_seed_v1.sql` (root) — 밸런스 게임 60문항 시드 (종합 20 + 노동 10 + 부동산 10 + 안보 10 + 젠더 10). 별도 받아온 외부 시드 파일이라 root 에 위치

---

## 라우트 구조

### 페이지 (EJS 렌더링)
| 경로 | 뷰 | 설명 |
|---|---|---|
| `/` | `views/index.ejs` | 홈 (KPI, 주목 법안, 활발 의원, 월별 추이) |
| `/politician` | `politician/politician.ejs` | 의원 목록 (정당 히스토그램, 그리드/리스트 토글, 사이드바 복수선택 필터) |
| `/politician/:id` | `politician/politician_detail.ejs` | 의원 상세 (분석·법안·표결·국민평가 탭, 분석이 기본) |
| `/bill` | `bill/bill.ejs` | 법안 목록 (AI 분석 진행률 배너 + 통합 필터 카드 + 정렬 + 카테고리·정당 복수선택, 페이징) |
| `/bill/:id` | `bill/bill_detail.ejs` | 법안 상세 (AI 분석 5-Zone·요청 위젯·국민 찬반·본회의 표결·댓글) |
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
| `/about` | `about.ejs` | 사이트 소개 |
| `/glossary` | `glossary.ejs` | 용어 설명 (목차 + 4섹션) |
| `/auth/login` | `auth/login.ejs` | 구글/카카오 로그인 |
| `/auth/setup` | `auth/setup.ejs` | 신규 OAuth 닉네임·성별·연령대 설정 (필수) |

### `/bill/:id` 5-Zone AI 분석 UI (2026-04-27 전면 리디자인)
`bill_ai_analysis` 테이블에 레코드가 있을 때만 5-Zone 렌더. 없으면 `.bill-basic-header` (옛 디자인 — 메타 + 법안명) + 분석 요청 위젯 노출.

**디자인 토큰** (분석 섹션 전용 — `.bill-ai-analysis` 스코프):
- 컬러: `--ba-ink #0F1B1F` (본문) / `--ba-sub #374151` (보조) / `--ba-meta #6B7280` (메타) / `--ba-gold #8F5800` (강조 단일색, 머스타드)
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
- **Zone 2 — 핵심 변화 3카드** (`#ba-changes`):
  - **비대칭 grid 8fr / 4fr / 4fr** (큰카드 18px / 작은카드 16px)
  - 좌측 4px 컬러바로 카드 구분 (모두 같은 #FAFAF7 배경):
    - `바뀌는 것` → `--ba-gold` 골드
    - `혜택받는 사람` → `--ba-ink` 차콜
    - `손해보는 곳` → `--ba-meta` 그레이
  - 이모지 전체 제거. 라벨은 mono 12px uppercase
- **Zone 3 — 분석** (`#ba-analysis`, 토글 폐기):
  - 항목별 `<article>` = H3(세리프 24px) + 본문 (펼침 기본)
  - 라벨(`찬성 논리`/`반대 우려`/`법안 빈틈`)은 카드 좌측 외부 **마진노트** (`position: absolute; left: -180px; width: 160px; text-align: right; mono 12px --ba-meta`)
  - 색상 배지·아코디언·"여기까지 70%" 프로그레스 모두 제거
  - 1240px 미만에서 마진노트 인라인으로 폴백
- **Zone 4 — 페이지 레벨 sticky 인덱스** (`.pb-section-index`, 2026-04-27 페이지 레벨):
  - `position: fixed; top: var(--nav-h) + 32px; left: min(calc(50% + 480px), calc(100% - 232px)); width: 200px` — 콘텐츠 우측에 밀착, 좁은 화면 클램프
  - **두 그룹** — `AI 분석` (요약/핵심 변화/분석/함께 생각) + `참여` (국민 찬반/본회의 표결/의견) ※ 발의자는 Zone 1 헤더 스택으로 통합되어 인덱스 항목에서 제거
  - 그룹별 좌측 1px 가이드 라인 + 8px 도트 (외곽선 `#C8C0AA` → 활성 채움 `#8F5800` + 4px glow). 도트 안쪽 `--bg` 채움으로 라인이 점 뒤로 안 보이게
  - 그룹 라벨: mono 10px / letter-spacing 0.22em / `#A8A095` uppercase
  - 항목: 12px / 7px 패딩 / 우측 카운트 (10px `#A8A095`)
  - 데이터 카운트(찬반·의견) 페이지 로드 후 `PB.fetch` 로 동적 채움 (본회의 표결은 서버 SSR)
  - **스크롤 기반 활성 트리거** (IntersectionObserver 의 좁은 활성 띠로 짧은 마지막 섹션 못 잡는 문제 회피). DOM 순서대로 순회 → `top <= getScrollOffset()` 인 마지막 섹션 active. 페이지 끝 도달 시 마지막 섹션 강제 활성화
  - 클릭 스크롤 오프셋: `getScrollOffset()` = `--nav-h + 20` 동적 (데스크톱 120 / 모바일 80) — 5-Zone 헤드라인이 nav 뒤로 가리지 않게
  - `padding-left: 8px` — `overflow-y:auto` 가 x clip 하는 브라우저 동작 회피용 (도트 좌측 잘림 방지)
  - 1240px 미만 자동 숨김 → 모바일 floating jumpbar 로 대체

- **모바일 floating jumpbar** (`.pb-mobile-jumpbar`):
  - `position: fixed; bottom: max(16px, env(safe-area-inset-bottom, 16px))` — iOS 홈 인디케이터 보호
  - 768~1239px (Fold 펼친·작은 노트북·태블릿) + <768 모바일 모두 노출. ≥1240 데스크톱은 sticky 인덱스 사용
  - 4 핵심 탭 (요약·분석·찬반·의견) + 골드 ↑ 버튼
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

- **Zone 7 — 챕터 디바이더** (`.ba-chapter`): 분석 끝 ↔ 참여 시작 사이 풀폭 브레이크. 상단 1px 보더 + 메인 헤딩 세리프 900 / 36px "이제 당신이 답할 차례입니다" + 서브 15px `#6B7280` "법안에 찬반을 표시하고, 다른 시민들의 의견을 읽어보세요"
- **Zone 8 — 국민 찬반** (`#citizen-vote-section .pb-part`): cv-bar 12px / 차콜+골드. CTA 두 버튼 동일 무게 흰 배경. 위치(좌/우) 로만 입장 구분 — 이모지 제거
- **Zone 9 — 본회의 표결** (`#part-floor-vote`): 데이터 없을 때 italic `#9B9486` empty state. 있을 때 4-박스 vote-dashboard 톤만 통일 (정당색은 객관 데이터라 그대로)
- ~~**Zone 10 — 발의자**~~: **2026-04-27 폐기** — 발의자는 메타데이터의 일부라 Zone 1 헤더 컴팩트 스택으로 통합됨. 참여 영역에서 분리
- **Zone 11 — 댓글** (`#part-comments`): 정렬 토글 알약 → 텍스트 underline. 카드 흰 배경 / `#E8E5DC` / radius 10. 닉네임 700, 본문 14/1.7. 좋아요 활성 골드

### `/bill/:id` 분석 요청 위젯 (2026-04-25)
미분석 법안에서만 노출. `bill-basic-header` 바로 아래 골드 그라디언트 카드.
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

### `/politician/:id` 페이지 구조 (2026-04-25 재편)
- **히어로**: breadcrumb → `.profile-identity` (아바타 240px + 이름·정당배지·메타) → `.profile-subinfo` (생년월일·성별 / 이메일 / 홈페이지·국회프로필 — flex-wrap, 이메일만 `.full` 로 단독 행). 카드 박스 없이 hero 배경에 자연스럽게 녹아듬
- **탭**: `[분석(기본), 법안 활동, 표결 내역, 국민 평가]`
- **분석 탭** (기본 활성): KPI 행(발의·표결참여·가결율) → `overview-grid` 3카드(활동 레이더 / 표결 성향 / 관심분야 TOP 5) → `overview-grid.two` (월별 발의 + 정당별 공동발의 협력 | 주요 법안 이력 타임라인). "숫자 요약 → 시각화 → 시계열·관계" 흐름
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

### 공용 미들웨어
- `middlewares/auth.js`
  - `requireLogin` — API 401 / 페이지 `/auth/login?next=...` 리다이렉트
  - `injectUser` — `res.locals.currentUser` + `req.session.userId` 주입
- `utils/dataFreshness.js`
  - `dataFreshnessMiddleware(db)` — `MAX(bills.updated_at)` 조회 + 10분 메모리 캐시, `res.locals.dataFreshness = { lastUpdated, relative, absolute }` 주입
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
| `syncVotes.js` | 열린국회 API (`nojepdqqaweusdfbi`) | 본회의 표결 (수집 완료 144,943건) |
| `syncMissingBillDetails.js` | ALLBILL API | 상세 누락분 보강 |
| `syncPhotos.js` | 크롤링 | 의원 프로필 사진 |
| `updateCommittee.js` | 열린국회 API | `syncBills.js` 이전 레코드 committee 컬럼 보강 (pSize=1000, bulk VALUES UPDATE) |
| `syncBillAiAnalysis.js` | pal.assembly.go.kr 크롤 + Claude Haiku 4.5 | AI 법안 분석 (v4.1, 16종 카테고리) |
| `reclassifyCategories.js` | Claude Haiku 4.5 | 자유 카테고리 → v4.1 16종 main+sub 일괄 재분류 |
| `billCategories.js` | (모듈) | 16종 카테고리·정의·tie-breaker 공유 (분석/재분류 배치가 import) |
| `calcGroupAxisAvg.js` | DB 집계 | 인구 그룹별 4축 평균 일배치 (밸런스 게임 단계 4 비교용). 'all' + (gender × age_group), user_count >= 50 만 평균 채움 |
| `calcPoliticianAxis.js` | DB 집계 | `bill_axis_mapping × bill_votes` → `politician_axis_score`. 가중평균 (찬성→agree_score / 반대→disagree_score, 기권/불참 제외). 인자 `--version v1` `--min-votes 1`. 분포 히스토그램 + 정당별 평균 검증 출력 |

### syncBills.js 결과
- RST_MONA_CD → bills.mona_cd, PUBL_MONA_CD → bill_co_proposers
- committee / committee_id 동시 INSERT + ON CONFLICT UPDATE
- 16,817건 법안 + 217,568건 발의자 (75초)

### syncBillAiAnalysis.js (2026-04-25 신규, 04-26 v4.1)
**흐름**: 미분석 대상 조회 → `pal.assembly.go.kr/napal/lgsltpa/lgsltpaDone/view.do?lgsltPaId=<bill_id>` 본문 cheerio 파싱 → Haiku 분석 → `bill_ai_analysis` UPSERT
- 인자: `--limit N` (기본 3) / `--bill-id ID...` 직접 지정
- Phase 1 자동 선별: `proc_result_name IN ('원안가결','수정가결')` + 미분석만
- 모델: `claude-haiku-4-5-20251001` / 가격: input $1.0, output $5.0, cache write $1.25, cache read $0.10 (per MTok)
- prompt caching 적용 (`cache_control: ephemeral`) 단 Haiku 4.5 임계값 미달로 현재 system(~3,300 tok)에선 활성화 안 됨 (cache_w/cache_r=0). 4,500+ 으로 늘면 자동 활성
- 요청 간 sleep 1500ms + 429 retry-after 대응
- 후처리: `TYPO_MAP` 오타 치환, `validateCategoryMain` (16종 외 라벨이면 `needs_review=true`), `shouldReview` 휴리스틱(연도 3+ / 기관·법명 5+ / limitations 3+)
- 비용 (v4.1): input ~5,170 tok, **1건당 ~$0.0172**. 가결 490건 추정 ~$8.4

### reclassifyCategories.js (2026-04-26 신규)
한 번의 Haiku 호출로 N건 일괄 재분류. v4 자유 카테고리 → v4.1 main+sub.
- 인자: `--all` (v4.1 도 강제 재분류) / `--dry-run` (DB 안 씀)
- `BEGIN`/`COMMIT` 트랜잭션, 16종 외면 `needs_review=true`
- 결과: 12건 $0.0068 (1건당 $0.0006) 매우 싸다 — 일괄 호출이라 카테고리 결정 컨텍스트가 한 번만 들어가서

> 폐기된 배치 파일(topicUpdate.js, updateByCommittee.js)은 [CHANGELOG.md](./CHANGELOG.md) 참조.

---

## 환경변수

```
# DB / 서버
DATABASE_URL=postgresql://...@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
PORT=3000
NODE_ENV=production
BASE_URL=http://localhost:3000      # 프로덕션: https://politics-production.up.railway.app

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
```

### Git 안전 수칙
- `.gitignore` 에 OAuth/secret 파일 패턴 등록됨 (`*OAuth*.json`, `*secret*.json` 등)
- 실수로 시크릿 푸시된 경우: `git rm --cached` + `--amend` 로 로컬 커밋 정리, Google Console 에서 **Reset Secret** 권장

---

## 브랜드 에셋

### 현재 사용 중 (`public/assets/imgs/`)
- nav 로고: `mark-only.svg` (36px) + `wordmark-nav.svg` (h28px, 단일행)
- login 카드: `mark-only.svg` (48px) + `wordmark-nav.svg` (h36px, gap 12px)
- 파비콘: `favicon.ico`, `favicon-16.svg`, `favicon-32.svg`, `apple-touch-180.png`
- 앱 아이콘: `app-icon-192.png`, `app-icon-512.png` (`public/manifest.json` 참조)
- OG: `og-image.png` (1200×630)

### 미배치 (추후 활용)
- `logo-white.svg` — 다크모드 도입 시
- `logo-mono.svg` — 인쇄·흑백 매체
- `wordmark-kr.svg` — 태그라인 포함 ("내 한표의 바로미터", OG 변형 등)
- `wordmark-en.svg` — 영문 서브 포함
- `splash.svg` — 페이지 진입 로더 (전역 스플래시 UI 필요)
- `spinner.svg` — API 대기 로더 (전역 스피너 UI 필요)
- `app-icon-1024.png` — 스토어 등록 시

### 디자인 규칙
- 브랜드 골드: `#B8740C` / 호버: `#925C09`
- 정당색(파랑·빨강) 사용 엄격 금지 — 중립성 브랜드 핵심
- 점 복(卜) 문양 획 방향: 우하단 ↘ (실제 기표봉 기준)

### 메타 태그 & PWA
- `views/layout.ejs <head>` — favicon 5종 + manifest + OG 11개 + Twitter 4개 + theme-color
- `og:url` / `og:image` 는 `process.env.BASE_URL + locals.currentUrl` 기반 절대 URL
- `public/manifest.json` — name/short_name/start_url/display=standalone/theme-color/icons(any maskable)

---

## Claude Code 빠른 시작

```bash
# 서버 로컬 실행
npm run dev

# 배치 실행 예시
node batch/syncPoliticians.js
node batch/syncBills.js
node batch/syncVotes.js
node batch/updateCommittee.js    # committee 컬럼 보강

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
