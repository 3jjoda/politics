const express = require('express');
const app = express();
const port = 3000;
const mysql = require('mysql2');

require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_DATABASE 
});

// 미들웨어
app.use(express.json());
app.use(express.static('public'));

// 데이터베이스 연결
db.connect((err) => {
  if (err) {
    console.error('MySQL 연결 실패:', err);
    return;
  }
  console.log('MySQL 연결 성공!');
  
  // 데이터베이스 연결 성공 시에만 라우터를 불러오고 DB 객체를 전달
  const inquiryRoutes = require('./routes/inquiryRoutes')(db);
  
  // API 라우터 사용
  app.use('/api', inquiryRoutes);

  app.listen(port, () => {
    console.log(`웹 서버가 실행되었습니다: http://localhost:${port}`);
  });
});