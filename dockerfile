# Node.js 20 버전 기반의 이미지를 사용
FROM node:20-alpine

# 컨테이너의 작업 디렉토리를 /app으로 설정
WORKDIR /app

# package.json 파일을 복사하여 의존성 설치
COPY package*.json ./
RUN npm install

# 나머지 모든 파일을 컨테이너로 복사
COPY . .

# 애플리케이션이 3000번 포트를 사용한다고 명시
EXPOSE 3000

# 컨테이너가 시작될 때 실행될 명령어
CMD ["node", "app.js"]