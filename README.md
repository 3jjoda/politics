# 프로젝트명: 정치 바로미터

## 🎯 프로젝트 소개

'정치 바로미터'는 국민이 정치인과 정책에 대한 객관적이고 투명한 정보를 바탕으로 합리적인 정치적 선택을 할 수 있도록 돕기 위해 개발된 웹 플랫폼입니다.
공식 자료를 비롯한 다양한 데이터를 수집, 분석, 시각화하여 유권자들이 정치인의 △의정 활동 △법안 발의 내역 △공약 이행도 △대외 활동 등을 한눈에 파악할 수 있도록 제공합니다.

정보의 비대칭을 해소하고, 국민의 적극적인 참여와 소통을 통해 더욱 건강한 민주주의 사회를 만들어가는 것을 목표로 합니다.

## ✨ 주요 기능

* **정치인 프로필:** 각 정치인의 상세 정보, 소속 정당, 재선 횟수, 주요 활동 등을 제공합니다.
* **의정 활동 분석:** 발의 법안 목록, 국회 출석률, 위원회 활동 등 객관적인 데이터를 기반으로 한 활동 지표를 제공합니다.
* **국민 평점 및 댓글:** 사용자들의 직접 참여를 통해 정치인에 대한 평가와 의견을 공유할 수 있는 커뮤니티 기능을 제공합니다.
* **반응형 UI:** 모바일, 태블릿, 데스크톱 등 다양한 기기에서 최적화된 사용자 경험을 제공합니다.
* **레이아웃 기반 템플릿:** EJS 레이아웃 시스템을 통해 일관된 UI와 효율적인 유지보수를 지원합니다.

## 🛠️ 기술 스택

* **백엔드:**
    * **Node.js:** 서버 런타임 환경
    * **Express.js:** 웹 애플리케이션 프레임워크
* **데이터베이스:**
    * **AWS RDS (Relational Database Service):** 안정적이고 확장 가능한 관계형 데이터베이스 서비스 (MySQL 8.0)
* **프론트엔드:**
    * **EJS (Embedded JavaScript):** 서버 사이드 템플릿 엔진
    * **HTML5, CSS3, JavaScript (Vanilla JS, ES6+):** 웹 표준 기술
    * **Bootstrap 5.3:** 반응형 디자인 및 컴포넌트 라이브러리 (CDN 사용)
    * **Font Awesome 6.x:** 아이콘 라이브러리 (CDN 사용)
    * **Google Fonts (Noto Sans KR):** 폰트 스타일 (CDN 사용)
* **개발/배포:**
    * **AWS EC2 (Elastic Compute Cloud):** 애플리케이션 서버 호스팅
    * `npm` 또는 `yarn`: 패키지 매니저
    * `express-ejs-layouts`: EJS 템플릿 레이아웃 관리 미들웨어

## 📁 프로젝트 구조
POLITICS/
├── app.js                      # Express 서버 진입점 및 주요 설정 (DB 연결 로직 포함)
├── package.json                # 프로젝트 정보 및 의존성
├── public/                     # 클라이언트가 직접 접근 가능한 정적 파일 (CSS, JS, 이미지)
│   ├── assets/
│   │   └── imgs/               # 이미지 파일
│   ├── styles/                 # 공통 및 페이지별 CSS 파일
│   │   ├── common.css
│   │   ├── main.css
│   │   ├── about.css           # '사이트 소개' 페이지 CSS
│   │   ├── politician/
│   │   │   └── politician.css  # '정치인 목록' 페이지 CSS
│   │   └── ...
│   └── scripts/                # 클라이언트 사이드 JavaScript 파일
│       ├── globalStore.js
│       ├── main.js             # 전역 스크립트 (모바일 메뉴 토글 등)
│       ├── politician/
│       │   └── politician.js   # '정치인 목록' 페이지 스크립트
│       └── ...
└── views/                      # EJS 템플릿 파일
    ├── layout.ejs              # 모든 페이지의 공통 레이아웃 (헤더, 푸터, 기본 HTML 구조)
    ├── index.ejs               # 메인 페이지
    ├── about.ejs               # 사이트 소개 페이지
    ├── politician/
    │   └── politician.ejs      # '정치인 목록' 페이지
    └── ...

## 🚀 시작하는 방법

이 프로젝트를 로컬 환경에서 실행하기 위한 단계별 가이드입니다.

### 1. 프로젝트 클론
https://github.com/3jjoda/politics.git

### 2. 의존성 설치
npm install

### 3. 환경 변수 설정
프로젝트 루트에 .env 파일을 생성하고 다음 환경 변수를 설정해야 합니다. 이 변수들은 AWS RDS 데이터베이스 연결 및 기타 설정에 사용됩니다.
(.env 파일은 .gitignore에 추가하여 버전 관리에서 제외하는 것이 중요합니다.)

DB_HOST=politics.cdg04ws4c5db.ap-southeast-2.rds.amazonaws.com
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_DATABASE=politics
PORT=3000

### 4. 서버 실행
node app.js