# 당말사 (당 말고 사람)

> "더 이상 당만 보고 투표하는 사람이 없도록"
> 내가 행한 한 표가 어떻게 나라를 굴리고 있는지 끝까지 지켜볼 수 있는 플랫폼

- **배포**: https://politics-production.up.railway.app
- **저장소**: https://github.com/3jjoda/politics (dev 브랜치)

## 🎯 프로젝트 소개

'당말사'는 국민이 정치인과 정책에 대한 객관적이고 투명한 정보를 바탕으로 합리적인 정치적 선택을 할 수 있도록 돕기 위해 개발된 웹 플랫폼입니다.

열린국회정보 공공 API 데이터(의원·법안·본회의 표결)를 수집·분석·시각화하고, AI 법안 분석과 정치 성향 진단(밸런스 게임)을 통해 유권자가 "정답"이 아닌 **판단 근거**를 얻을 수 있도록 제공합니다.

정보의 비대칭을 해소하고, 국민의 적극적인 참여와 소통을 통해 더욱 건강한 민주주의 사회를 만들어가는 것을 목표로 합니다.

## ✨ 주요 기능

* **의원 프로필·분석**: 22대 국회의원 295명의 발의·표결 활동, KPI·레이더 차트·관심분야 TOP 5 등 활동 분석 탭
* **법안 목록·상세**: 법안 16,800여 건 + 본회의 표결 144,000여 건. 위원회·정당·AI 카테고리 복수 필터와 정렬 지원
* **AI 법안 분석 (5-Zone)**: Claude API 기반 — 한 줄 요약, 핵심 변화, 찬성 논리·반대 우려·법안 빈틈, 판단 질문. 미분석 법안은 사용자 분석 요청(임계값 도달 시 우선 분석)
* **정치 성향 밸런스 게임**: 실제 법안 기반 4축(경제·사회·안보·제도) 성향 진단 5단계 — 응답 → 펼침 → 비교 → 의원 연결. 의원별 "나와의 일치도" 필터·정렬
* **국민 참여**: 법안 국민 찬반 투표, 의원 별점, 댓글(대댓글·좋아요), 커뮤니티 게시판(법안 첨부)
* **소셜 로그인**: Google / Kakao OAuth (Passport)
* **반응형 UI**: 라이트 테마 · 골드 액센트 디자인 시스템, 모바일 jumpbar·바텀시트 필터 등 기기별 최적화

## 🛠️ 기술 스택

* **백엔드**
    * **Node.js + Express 5.1**: 웹 애플리케이션 프레임워크
    * **Passport** (google-oauth20, kakao) + **express-session** + **connect-pg-simple**: 인증·세션
* **데이터베이스**
    * **Supabase PostgreSQL** (Transaction Pooler, ap-northeast-1) — `pg` 드라이버
* **프론트엔드**
    * **EJS** + `express-ejs-layouts`: 서버 사이드 템플릿
    * **HTML5, CSS3, Vanilla JS (ES6+)**: 프레임워크 없이 공통 CSS(`.pb-*`)와 전역 헬퍼(`window.PB`)로 구성
    * **폰트**: Noto Sans KR / Noto Serif KR / Pretendard Variable / JetBrains Mono
* **AI / 데이터**
    * **Claude API** (claude-haiku-4-5): 법안 분류·AI 법안 분석 (JSON mode, v4.1 프롬프트)
    * **열린국회정보 Open API**: 의원·법안·표결 데이터 동기화 배치
* **배포**
    * **Railway**: 애플리케이션 호스팅 (배포 완료)

## 📁 프로젝트 구조

```
POLITICS/
├── app.js                  # Express 서버 진입점
├── routes/                 # 라우터 (페이지 + REST API)
├── controllers/            # 컨트롤러
├── services/               # 비즈니스 로직
├── daos/                   # DB 접근 (SQL)
├── middlewares/            # auth(requireLogin, injectUser), balanceGame 등
├── utils/                  # dataFreshness 등 유틸
├── config/                 # 설정 (DB, passport 등)
├── batch/                  # 데이터 동기화·AI 분석 배치 스크립트
│   ├── syncPoliticians.js  #   의원 마스터 동기화 (열린국회 API)
│   ├── syncBills.js        #   법안 + 발의자 동기화
│   ├── syncVotes.js        #   본회의 표결 동기화
│   ├── syncBillAiAnalysis.js  # AI 법안 분석 (Claude Haiku)
│   ├── calcPoliticianAxis.js  # 의원 4축 좌표 산출 (밸런스 게임)
│   └── ...
├── etc/ddl/                # DB 스키마 (DDL·마이그레이션·시드)
├── public/                 # 정적 파일
│   ├── styles/main.css     #   공통 CSS (.pb-* prefix)
│   ├── scripts/interactions.js  # 전역 헬퍼 (window.PB — 위젯·fetch·아바타 등)
│   └── assets/imgs/        #   브랜드 에셋·이미지
└── views/                  # EJS 템플릿
    ├── layout.ejs          #   공통 레이아웃
    ├── politician/         #   의원 목록·상세
    ├── bill/               #   법안 목록·상세 (AI 분석 5-Zone)
    ├── balance/            #   밸런스 게임 5단계
    ├── community/          #   커뮤니티
    ├── my/                 #   마이페이지
    └── auth/               #   로그인·가입 설정·환영
```

## 📚 프로젝트 문서

| 문서 | 내용 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 현재 코드 상태 (스키마·라우트·컴포넌트 상세) |
| [ROADMAP.md](./ROADMAP.md) | 비전·미구현 기획·우선순위 |
| [CHANGELOG.md](./CHANGELOG.md) | 작업 이력 (시간 역순) |
| [ANALYSIS.md](./ANALYSIS.md) | AI 법안 분석 생성 원칙 |
| [UI_ANALYSIS.md](./UI_ANALYSIS.md) | AI 분석 UI 표시 원칙 |
| [BALANCEGAME.md](./BALANCEGAME.md) | 밸런스 게임 설계 원칙 (4축·매핑·D 레이어) |
| [UI_BALANCEGAME.md](./UI_BALANCEGAME.md) | 밸런스 게임 5단계 UI 설계 원칙 |
| [PACK_DESIGN_GUIDE.md](./PACK_DESIGN_GUIDE.md) | 게임팩 추가 가이드 |
| [BILL_AXIS_MAPPING_GUIDE.md](./BILL_AXIS_MAPPING_GUIDE.md) | 법안-축 매핑 가이드라인 |

## 🚀 시작하는 방법

### 1. 프로젝트 클론

```bash
git clone https://github.com/3jjoda/politics.git
cd politics
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다. (`.env`는 `.gitignore`에 포함되어 버전 관리에서 제외됩니다.)

```
# DB (config/database.js 가 읽는 키)
DB_HOST=<supabase-pooler-host>
DB_PORT=6543
DB_USER=<user>
DB_PASSWORD=<password>
DB_DATABASE=postgres
DB_SSL=true

# 서버
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# 세션
SESSION_SECRET=<32자 이상 랜덤 문자열>

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=        # Kakao 콘솔에서 "Client Secret 사용함"일 때만

# 공공 API / AI
OPEN_ASSEMBLY_API_KEY=
ANTHROPIC_API_KEY=
ASSEMBLY_AGE=22

# AI 분석 요청 임계값 (기본 5명)
ANALYSIS_REQUEST_THRESHOLD=5
```

### 4. DB 스키마 적용

`etc/ddl/` 의 DDL → `etc/ddl/migrations/` → `etc/ddl/seeds/` 순으로 적용합니다.

### 5. 서버 실행

```bash
npm run dev
```

### 6. 데이터 동기화 (선택)

```bash
node batch/syncPoliticians.js   # 의원
node batch/syncBills.js         # 법안 + 발의자
node batch/syncVotes.js         # 본회의 표결
```
