# Node.js Web Service Template

이 템플릿은 Node.js + Express + MySQL 기반의 웹서비스를 위한 기본 구조를 제공합니다.  
정적 페이지부터 API 서버, 관리자 기능까지 확장 가능한 구조로 설계되었습니다.

---

## 📦 프로젝트 구조

```
project-root/
├── public/                  # 정적 파일 루트
│   ├── assets/              # 이미지, 폰트 등
│   ├── styles/              # CSS 파일 (페이지별 분리)
│   ├── scripts/             # JS 파일 (페이지별 분리)
├── routes/                  # Express 라우터
├── controllers/             # 요청 처리 로직
├── models/                  # DB 접근 및 트랜잭션 처리
├── utils/                   # 로깅, 에러 핸들링 등
├── config/                  # 환경변수 및 DB 설정
├── views/                   # 서버 렌더링용 템플릿
└── app.js                   # 서버 초기화
```

---

## 🚀 실행 방법

```bash
npm install
node app.js
```
---

## 🛠 기술 스택

- Node.js + Express
- Docker
- MySQL (커넥션풀 + 트랜잭션 처리)
- HTML/CSS/JS (페이지별 분리)
- dotenv, morgan, winston 등 유틸 모듈

---

## 📌 특징

- ✅ **페이지별 리소스 분리**: HTML/CSS/JS를 기능 단위로 관리
- ✅ **RESTful API 구조**: `/api/politician`, `/api/users` 등
- ✅ **트랜잭션 처리 가능**: DB 일관성 확보
- ✅ **확장성 높은 구조**: 관리자 페이지, 인증 기능 등 쉽게 추가 가능
- ✅ **템플릿화 가능**: 다른 프로젝트에 그대로 복제해서 사용 가능

---

## 📁 예시 페이지

- `/pages/politician/politician.html` : 국회의원 목록
- `/pages/politician/politician_detail.html` : 국회의원 상세보기

---

## 📚 향후 확장 아이디어

- 공통 style/script 분리
- 사용자 인증 (JWT 또는 세션)
- 관리자 대시보드
- 파일 업로드 (multer)
- 페이징/검색 기능
- React/Vue 프론트엔드 통합

---

## 🙌 만든 사람

- 개발자: umtaetae
- 목적: 기능이 다양한 웹서비스를 위한 구조적 템플릿