const express = require('express');
const app = express();
const port = 3000;
const mysql = require('mysql2');
require('dotenv').config();
console.log('읽어온 환경 변수:', process.env.DB_USER, process.env.DB_PASSWORD);

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_DATABASE 
});

// 라우터 파일 불러오기
const inquiryRoutes = require('./routes/inquiryRoutes');

// 미들웨어
app.use(express.json());
app.use(express.static('public'));

// db 객체를 모든 요청에 추가하는 미들웨어
app.use((req, res, next) => {
    req.db = db;
    next();
});

// 데이터베이스 연결
db.connect((err) => {
    if (err) {
        console.error('MySQL 연결 실패:', err);
        return;
    }
    console.log('MySQL 연결 성공!');
  
    // API 라우터 사용
    app.use('/api', inquiryRoutes); // 견적문의 라우터

    app.listen(port, () => {
        console.log(`웹 서버가 실행되었습니다: http://localhost:${port}`);
    });
});