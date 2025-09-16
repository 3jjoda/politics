import express from 'express';
import mysql from 'mysql2';
import logger from './utils/logger.js';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3000;

/* 커넥션풀 생성 */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/* 미들웨어 설정 */
app.use(express.json());
app.use(express.static('public'));

/* db.query 래핑: SQL + 결과 건수 자동 로깅 */
const originalQuery = db.query.bind(db);

db.query = function (sql, values, callback) {
  if (typeof values === 'function') {
    callback = values;
    values = [];
  }

  const formattedSql = mysql.format(sql, values);
  logger.info(`Executing query:\n${formattedSql}`);

  const wrappedCallback = function (err, results, fields) {
    if (err) {
      logger.error(`Query error: ${err.message}`);
    } else if (Array.isArray(results)) {
      logger.info(`Query result: ${results.length}건 조회됨`);
    } else if (results && typeof results === 'object' && 'affectedRows' in results) {
      logger.info(`Query result: ${results.affectedRows}건 영향받음`);
    } else {
      logger.info(`Query result: 형식 확인 필요`);
    }

    callback(err, results, fields);
  };

  return originalQuery(sql, values, wrappedCallback);
};

/* 서버 초기화 함수 */
const startServer = async () => {
  try {
    // ✅ 라우터 목록 정의
    const routeModules = [
      { path: '/api', file: './routes/inquiryRoutes.js' }
      // 여기에 추가 가능: { path: '/api/users', file: './routes/userRoutes.js' }
    ];

    // ✅ 라우터 불러오기 및 등록
    for (const route of routeModules) {
      const module = await import(route.file);
      app.use(route.path, module.default(db));
    }

    // ✅ 에러 핸들링 미들웨어
    app.use((err, req, res, next) => {
      logger.error(`서버 에러 발생: ${err.message}`, { stack: err.stack });
      res.status(500).send('서버에서 에러가 발생했습니다.');
    });

    // ✅ 서버 시작
    app.listen(port, () => {
      logger.info(`웹 서버가 실행되었습니다: http://localhost:${port}`);
    });
  } catch (error) {
    logger.error('서버 초기화 중 오류 발생:', { stack: error.stack });
  }
};

startServer();