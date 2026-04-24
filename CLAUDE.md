# 3jjoda 프로젝트 — Claude Code 컨텍스트
> 마지막 업데이트: 2026-04-24
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
--green:   #0F9D6E / --red: #D03A3A / --purple: #7C3AED
--nav-h:   60px       고정 nav 높이
```
- 폰트: Noto Sans KR 15px/1.75, `word-break: keep-all`
  - **Noto Serif KR 900** (2026-04-24 추가) — 법안 분석 Zone 1 한 줄 요약·Zone 4 판단 질문 전용
- 공통 CSS: `public/styles/main.css` (`.pb-*` prefix)

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
- `politician_party_memberships` — 의원-정당 이력
- `bills` (PK bill_id VARCHAR), `bill_co_proposers`, `bill_votes` — 법안·발의자·표결
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

-- 법안 시민 찬반 (국회의원 표결과 별개)
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

### AI 법안 분석 테이블 (2026-04-24 신규)

```sql
-- 5-Zone UI 구조에 직접 매핑되는 JSONB 중심 테이블
CREATE TABLE bill_ai_analysis (
  bill_id              VARCHAR(50) PRIMARY KEY REFERENCES bills(bill_id) ON DELETE CASCADE,
  summary              TEXT        NOT NULL,      -- Zone 1 한 줄 요약
  category             VARCHAR(50),               -- Zone 1 태그
  reading_time_min     SMALLINT    DEFAULT 2,     -- Zone 1 "읽기 N분"
  changes              JSONB       NOT NULL,      -- Zone 2 {current, revised, clause}
  affected             JSONB       NOT NULL,      -- Zone 2 {benefit, loss, direct[], indirect[]}
  issues               JSONB       NOT NULL,      -- Zone 3 [{type, title, body}] — type: pro|con|gap
  context              JSONB,                     -- Zone 5 참고 맥락 (미구현)
  limitations          JSONB,                     -- Zone 5 분석 한계 (미구현)
  judgment_questions   JSONB       NOT NULL,      -- Zone 4 [{question, hint}]
  model                VARCHAR(50) NOT NULL,      -- 예: claude-haiku-4-5-20251001
  prompt_version       VARCHAR(10) NOT NULL,      -- 예: v4 (v4-sample = 수동 시드)
  tokens_input         INT,
  tokens_output        INT,
  cost_usd             NUMERIC(8,6),              -- 건당 비용 추적
  needs_review         BOOLEAN     DEFAULT FALSE, -- 사실 오류 의심 플래그
  review_status        VARCHAR(20) DEFAULT 'auto',-- auto|human_approved|human_rejected
  analyzed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
-- 인덱스: prompt_version / needs_review(partial WHERE TRUE) / category
-- 트리거: trg_bill_ai_analysis_updated_at
```

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
  `bill_ai_analysis.sql` (2026-04-24 신규 — 샘플 INSERT 포함)

---

## 라우트 구조

### 페이지 (EJS 렌더링)
| 경로 | 뷰 | 설명 |
|---|---|---|
| `/` | `views/index.ejs` | 홈 (KPI, 주목 법안, 활발 의원, 월별 추이) |
| `/politician` | `politician/politician.ejs` | 의원 목록 (정당 히스토그램, 그리드/리스트 토글) |
| `/politician/:id` | `politician/politician_detail.ejs` | 의원 상세 (법안·표결·국민평가 탭) |
| `/bill` | `bill/bill.ejs` | 법안 목록 (상태 스테퍼, 카테고리 사이드바, 페이징) |
| `/bill/:id` | `bill/bill_detail.ejs` | 법안 상세 (AI 분석 5-Zone·시민 찬반·본회의 표결·댓글) |
| `/community` | `community/list.ejs` | 게시판 목록 (20개/페이지) |
| `/community/write` | `community/write.ejs` | 작성 (법안 검색 첨부) |
| `/community/:id/edit` | `community/write.ejs` | 수정 (mode=edit) |
| `/community/:id` | `community/detail.ejs` | 상세 (조회수·좋아요·댓글) |
| `/about` | `about.ejs` | 사이트 소개 |
| `/glossary` | `glossary.ejs` | 용어 설명 (목차 + 4섹션) |
| `/auth/login` | `auth/login.ejs` | 구글/카카오 로그인 |
| `/auth/setup` | `auth/setup.ejs` | 신규 OAuth 닉네임·성별·연령대 설정 (필수) |

### `/bill/:id` 5-Zone AI 분석 UI
`bill_ai_analysis` 테이블에 레코드가 있을 때만 렌더. 없으면 `.bill-basic-header` (메타 + 법안명) 로 대체.
- **Zone 1 — 훅**: 메타 2줄(#번호·위원회·상태 / 대표발의·발의일·공동발의) + `<h1>` 법안명 + `<h2>` 한 줄 요약 (세리프 28px/900) + 태그(카테고리·읽기시간·상태)
- **Zone 2 — 한눈에 보기**: 3카드 (바뀌는 것 / 혜택 / 손해) + "여기까지 읽으면 30%" 프로그레스
- **Zone 3 — 쟁점**: `issues[]` accordion (첫 번째만 기본 펼침). type별 배지 — `pro=파랑 / con=주황 / gap=회색` + "70%" 프로그레스
- **Zone 4 — 판단 질문**: `judgment_questions[]` 번호 매기기 + 골드톤 배경(`#FAF6EB`) + "찬반 투표하기" CTA → `#citizen-vote-section` smooth scroll
- **Zone 5 — 참고 맥락·분석 한계**: 미구현. DB에 `context`/`limitations` 컬럼은 존재. "더 알아보기" 버튼은 Zone 5 추가 시 부활 예정.
- **국회 원문 링크**: 헤더 카드 우측 상단에 배치 (`.zone-1-top > .original-link`)
- **XSS 방어**: `JSON.stringify(analysis).replace(/</g, '\\u003c')` + `renderRichText()` 헬퍼로 `<strong>` 만 허용하는 선별 이스케이프

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
| DELETE | `/api/auth/withdraw` | 회원 탈퇴 (익명화) |
| GET / POST / PUT / DELETE | `/api/comments[/:id]` | 댓글 CRUD (소프트 삭제, 대댓글 1단계) |
| GET / POST | `/api/ratings/politician/:monacd` | 별점 조회/UPSERT |
| GET / POST | `/api/votes/bill/:billId` | 시민 찬반 조회/UPSERT |
| GET / POST | `/api/likes` | 좋아요 토글/카운트 |
| GET | `/api/bills/search?q=X` | 법안 검색 (커뮤니티 첨부용) |
| GET | `/api/bills/trending?sort=recent\|close\|popular\|bipartisan` | 홈 주목할 법안 (정렬 탭 동적 교체) |
| POST | `/community` | 게시글 작성 |
| PUT / DELETE | `/community/:id` | 수정/삭제 (본인만) |

### 법안 필터 URL 규약
- `/bill?committee=행정안전위원회` — 단일 위원회 필터
- `/bill?committee=기획재정위원회,재정경제기획위원회` — **쉼표 분리 복수 매칭** (`string_to_array` 로 SQL IN 처리)
- 홈 카테고리 탭 "조세/재정", 사이드바 "기타/특별위원회" 묶음이 이 방식 사용
- 카테고리 + 상태 탭 연동: committee 선택 시 스테퍼·상태 탭 숫자 모두 해당 위원회 기준으로 재계산

### 공용 미들웨어
- `middlewares/auth.js`
  - `requireLogin` — API 401 / 페이지 `/auth/login?next=...` 리다이렉트
  - `injectUser` — `res.locals.currentUser` + `req.session.userId` 주입

---

## 프론트엔드 상호작용 헬퍼 (`public/scripts/interactions.js`)
`window.PB` 전역 네임스페이스:
- `PB.fetch(path, opts)` — JSON + credentials 자동 처리
- `PB.mountRating({containerId, monaCd})` — 별점 위젯
- `PB.mountComments({containerId, type, targetId})` — 댓글 위젯 (작성·수정·삭제·좋아요·정렬)
- `PB.mountCitizenVote({containerId, billId})` — 법안 시민 찬반
- `PB.mountBillAnalysis({containerId, analysisData, bill, scrollTargetId})` — AI 법안 분석 5-Zone 위젯
  - `renderRichText()` 내부 헬퍼 — `<strong>` 만 허용하는 선별 이스케이프 (2026-04-24)
  - Zone 3 accordion — 첫 번째만 기본 펼침, 클릭 시 `max-height` 트랜지션
  - Zone 4 "찬반 투표하기" → `scrollTargetId` (기본 `citizen-vote-section`) smooth scroll
  - `analysisData` falsy 시 컨테이너 `display:none` (EJS 조건부 렌더와 이중 안전장치)
- `PB.avatarSvg(name, size)` — 이니셜 SVG 아바타 (라이트 파스텔 8팔레트)
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

### syncBills.js 결과
- RST_MONA_CD → bills.mona_cd, PUBL_MONA_CD → bill_co_proposers
- committee / committee_id 동시 INSERT + ON CONFLICT UPDATE
- 16,817건 법안 + 217,568건 발의자 (75초)

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
```
